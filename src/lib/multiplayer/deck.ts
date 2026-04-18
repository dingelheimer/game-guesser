// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import { z } from "zod";
import type { DifficultyTier } from "@/lib/difficulty";
import { DIFFICULTY_THRESHOLDS } from "@/lib/difficulty";
import type { createServiceClient } from "@/lib/supabase/service";
import { PlatformOptionSchema } from "@/lib/platformBonus";
import type { HouseRuleParams } from "@/lib/multiplayer/lobby";

/** Service role Supabase client type used in deck-building logic. */
export type ServiceClient = ReturnType<typeof createServiceClient>;

/** Runtime schema for the turn phase stored in {@link TurnStateSchema}. */
export const TurnPhaseSchema = z.enum([
  "drawing",
  "placing",
  "challenge_window",
  "revealing",
  "platform_bonus",
  "team_voting",
  "expert_verification",
  "complete",
]);

/** Phase values for the turn state machine. */
export type TurnPhase = z.infer<typeof TurnPhaseSchema>;

/** Runtime schema for a single entry in a player's revealed timeline. */
export const TimelineEntrySchema = z.object({
  gameId: z.number().int(),
  releaseYear: z.number().int(),
  name: z.string(),
});

/** A single entry in a player's revealed timeline. */
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

const TeamVoteEntrySchema = z.object({
  position: z.number().int(),
  locked: z.boolean(),
});

/** Runtime schema for the persisted game_sessions.current_turn JSONB payload. */
export const TurnStateSchema = z.object({
  phase: TurnPhaseSchema,
  activePlayerId: z.uuid(),
  gameId: z.number().int(),
  screenshotImageId: z.string(),
  placedPosition: z.number().int().optional(),
  isCorrect: z.boolean().optional(),
  challengerId: z.uuid().optional(),
  challengeResult: z.enum(["challenger_wins", "challenger_loses"]).optional(),
  platformOptions: z.array(PlatformOptionSchema).optional(),
  platformBonusPlayerId: z.uuid().optional(),
  platformBonusCorrect: z.boolean().optional(),
  phaseDeadline: z.iso.datetime({ offset: true }).optional(),
  /** Per-player vote state for the team_voting phase. */
  votes: z.record(z.string(), TeamVoteEntrySchema).optional(),
});

/** Persistent turn state stored in game_sessions.current_turn JSONB. */
export type TurnState = z.infer<typeof TurnStateSchema>;

/**
 * Shuffle an array in-place using the Fisher-Yates algorithm.
 * Mutates and returns the input array.
 */
export function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j] as T;
    arr[j] = tmp as T;
  }
  return arr;
}

/**
 * Map a difficulty tier to the maximum popularity rank per year.
 */
export function difficultyToMaxRank(difficulty: DifficultyTier): number {
  return DIFFICULTY_THRESHOLDS[difficulty];
}

function isDeckResponse(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((gameId) => typeof gameId === "number");
}

/**
 * Build a shuffled deck of up to 200 game IDs for the given difficulty
 * and optional house rule filters.
 * Requires games to have a cover and at least one non-rejected screenshot.
 * Uses the service role client to call the build_deck PostgreSQL RPC.
 * Throws if the filtered pool has fewer than 30 games.
 */
export async function buildDeck(
  serviceClient: ServiceClient,
  difficulty: DifficultyTier,
  houseRules?: HouseRuleParams,
): Promise<number[]> {
  const maxRank = difficultyToMaxRank(difficulty);

  const rpcArgs: Record<string, unknown> = { p_max_rank: maxRank };
  if (houseRules?.genreLockId != null) rpcArgs["p_genre_id"] = houseRules.genreLockId;
  if (houseRules?.consoleLockFamily != null)
    rpcArgs["p_platform_family"] = houseRules.consoleLockFamily;
  if (houseRules?.decadeStart != null) rpcArgs["p_decade_start"] = houseRules.decadeStart;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await serviceClient.rpc("build_deck", rpcArgs as any);

  if (error !== null) {
    throw new Error(`Failed to build deck: ${error.message}`);
  }

  if (!isDeckResponse(data)) {
    throw new Error("Failed to build deck: no data returned");
  }

  return data;
}
