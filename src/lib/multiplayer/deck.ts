import "server-only";

import { z } from "zod";
import type { DifficultyTier } from "@/lib/difficulty";
import { DIFFICULTY_THRESHOLDS } from "@/lib/difficulty";
import type { createServiceClient } from "@/lib/supabase/service";
import { PlatformOptionSchema } from "@/lib/platformBonus";

/** Service role Supabase client type used in deck-building logic. */
export type ServiceClient = ReturnType<typeof createServiceClient>;

/** Runtime schema for the turn phase stored in {@link TurnStateSchema}. */
export const TurnPhaseSchema = z.enum([
  "drawing",
  "placing",
  "challenge_window",
  "revealing",
  "platform_bonus",
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
  platformBonusCorrect: z.boolean().optional(),
  phaseDeadline: z.iso.datetime().optional(),
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
 * Returns null for extreme difficulty (no rank limit).
 */
export function difficultyToMaxRank(difficulty: DifficultyTier): number | null {
  if (difficulty === "extreme") return null;
  return DIFFICULTY_THRESHOLDS[difficulty];
}

function isDeckResponse(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((gameId) => typeof gameId === "number");
}

/**
 * Build a shuffled deck of up to 200 game IDs for the given difficulty.
 * Requires games to have a cover and at least one non-rejected screenshot.
 * Uses the service role client to call the build_deck PostgreSQL RPC.
 */
export async function buildDeck(
  serviceClient: ServiceClient,
  difficulty: DifficultyTier,
): Promise<number[]> {
  const maxRank = difficultyToMaxRank(difficulty);

  const rpcArgs = maxRank !== null ? { p_max_rank: maxRank } : {};
  const { data, error } = await serviceClient.rpc("build_deck", rpcArgs);

  if (error !== null) {
    throw new Error(`Failed to build deck: ${error.message}`);
  }

  if (!isDeckResponse(data)) {
    throw new Error("Failed to build deck: no data returned");
  }

  return data;
}
