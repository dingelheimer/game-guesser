// SPDX-License-Identifier: AGPL-3.0-only

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PlatformOption } from "@/lib/platformBonus";
import type { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";
import { type SupabaseClient } from "./actionHelpers";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import type { TimelineEntry, TurnState } from "./deck";
import type { LobbySettings } from "./lobby";
import type {
  ChallengeMadePayload,
  ExpertVerificationResultPayload,
  GameOverPayload,
  PlacementMadePayload,
  PlatformBonusResultPayload,
  TeamGameOverPayload,
  TeamVoteResolvedPayload,
  TeamVoteUpdatedPayload,
  TurnRevealedPayload,
  TurnSkippedPayload,
  TurnStartedPayload,
} from "./turns";

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

export const SubmitPlacementSchema = z.object({
  position: z.number().int().min(0),
  sessionId: z.uuid(),
});

export const SessionIdSchema = z.object({
  sessionId: z.uuid(),
});

export const SkipTurnSchema = z.object({
  presenceUserIds: z.array(z.uuid()).default([]),
  reason: z.enum(["disconnect_timeout", "turn_timer_expired"]).default("turn_timer_expired"),
  sessionId: z.uuid(),
});

export const SubmitPlatformBonusSchema = z.object({
  selectedPlatformIds: z.array(z.number().int()),
  sessionId: z.uuid(),
});

export const SubmitExpertVerificationSchema = z.object({
  selectedPlatformIds: z.array(z.number().int()),
  sessionId: z.uuid(),
  yearGuess: z.number().int(),
});

export const SubmitTeamVoteSchema = z.object({
  locked: z.boolean(),
  position: z.number().int().min(0),
  presenceUserIds: z.array(z.uuid()).default([]),
  sessionId: z.uuid(),
});

// ---------------------------------------------------------------------------
// Database row schemas
// ---------------------------------------------------------------------------

export const GameSessionRowSchema = z.object({
  active_player_id: z.uuid().nullable(),
  current_turn: z.unknown().nullable(),
  deck: z.array(z.number().int()),
  deck_cursor: z.number().int(),
  room_id: z.uuid(),
  settings: z.unknown().nullable(),
  status: z.enum(["active", "finished", "abandoned"]),
  team_score: z.number().int().nullable().default(null),
  team_timeline: z.unknown().nullable().default(null),
  team_tokens: z.number().int().nullable().default(null),
  turn_number: z.number().int(),
  turn_order: z.array(z.uuid()),
});

export const GamePlayerRowSchema = z.object({
  display_name: z.string(),
  score: z.number().int(),
  timeline: z.unknown(),
  tokens: z.number().int(),
  turn_position: z.number().int(),
  user_id: z.uuid(),
});

export const GameRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  release_year: z.number().int(),
});

export const CoverRowSchema = z.object({
  game_id: z.number().int(),
  igdb_image_id: z.string(),
});

export const ScreenshotRowSchema = z.object({
  igdb_image_id: z.string(),
});

export const GamePlatformRowSchema = z.object({
  game_id: z.number().int(),
  platform_id: z.number().int(),
});

export const PlatformRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export const PlatformIdRowSchema = z.object({
  platform_id: z.number().int(),
});

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Supabase service-role client used by internal data loaders. */
export type ServiceClient = ReturnType<typeof createServiceClient>;

/** Parsed game session state needed for writes. */
export type WritableGameSession = Readonly<{
  activePlayerId: string;
  currentTurn: TurnState;
  deck: readonly number[];
  deckCursor: number;
  roomId: string;
  settings: LobbySettings;
  teamScore: number | null;
  teamTimeline: readonly TimelineEntry[] | null;
  teamTokens: number | null;
  turnNumber: number;
  turnOrder: readonly string[];
}>;

/** Parsed game player state needed for writes. */
export type WritableGamePlayer = Readonly<{
  displayName: string;
  score: number;
  timeline: readonly TimelineEntry[];
  tokens: number;
  turnPosition: number;
  userId: string;
}>;

/** Aggregated scoreboard snapshot used after a turn resolves. */
export type BoardState = Readonly<
  Pick<TurnRevealedPayload, "scores" | "timelines" | "tokens"> & {
    players: readonly WritableGamePlayer[];
  }
>;

/** Platform bonus lookup data for a single game card. */
export type PlatformBonusState = Readonly<{
  correctIds: readonly number[];
  correctPlatforms: readonly PlatformOption[];
  options: readonly PlatformOption[];
}>;

// ---------------------------------------------------------------------------
// Exported result types
// ---------------------------------------------------------------------------

/**
 * Follow-up state returned after a multiplayer turn resolves or is skipped.
 */
export type TurnFollowUpResult =
  | Readonly<{ gameOver: GameOverPayload; type: "game_over" }>
  | Readonly<{ gameOver: TeamGameOverPayload; type: "team_game_over" }>
  | Readonly<{ nextTurn: TurnStartedPayload; type: "next_turn" }>;

/**
 * Success payload returned by {@link resolveTurn}.
 */
export type ResolveTurnResult = Readonly<{
  followUp?: TurnFollowUpResult;
  reveal: TurnRevealedPayload;
}>;

/**
 * Success payload returned by {@link submitPlacement}.
 */
export type SubmitPlacementResult =
  | Readonly<{
      placement: PlacementMadePayload;
      type: "challenge_window";
    }>
  | Readonly<{
      followUp?: TurnFollowUpResult;
      placement: PlacementMadePayload;
      reveal: TurnRevealedPayload;
      type: "revealed";
    }>;

/**
 * Success payload returned by {@link submitChallenge}.
 */
export type SubmitChallengeResult = Readonly<{
  challenge: ChallengeMadePayload;
  followUp?: TurnFollowUpResult;
  reveal: TurnRevealedPayload;
}>;

/**
 * Success payload returned by {@link proceedFromChallenge}.
 */
export type ProceedFromChallengeResult = Readonly<{
  followUp?: TurnFollowUpResult;
  reveal: TurnRevealedPayload;
}>;

/**
 * Success payload returned by {@link submitPlatformBonus}.
 */
export type SubmitPlatformBonusResult = Readonly<{
  bonus: PlatformBonusResultPayload;
  followUp: TurnFollowUpResult;
}>;

/**
 * Success payload returned by {@link proceedFromPlatformBonus}.
 */
export type ProceedFromPlatformBonusResult = Readonly<{
  bonus: PlatformBonusResultPayload;
  followUp: TurnFollowUpResult;
}>;

/**
 * Success payload returned by {@link submitExpertVerification}.
 */
export type SubmitExpertVerificationResult = Readonly<{
  followUp: TurnFollowUpResult;
  verification: ExpertVerificationResultPayload;
}>;

/**
 * Success payload returned by {@link proceedFromExpertVerification}.
 */
export type ProceedFromExpertVerificationResult = Readonly<{
  followUp: TurnFollowUpResult;
  verification: ExpertVerificationResultPayload;
}>;

/**
 * Success payload returned by {@link acceptChallenge}.
 */
export type AcceptChallengeResult = Readonly<{
  allAccepted: boolean;
  followUp?: TurnFollowUpResult;
  reveal?: TurnRevealedPayload;
}>;

/**
 * Success payload returned by {@link skipTurn}.
 */
export type SkipTurnResult = Readonly<{
  followUp: TurnFollowUpResult;
  skipped: TurnSkippedPayload;
}>;

/**
 * Success payload returned by {@link submitTeamVote}.
 */
export type SubmitTeamVoteResult =
  | Readonly<{ type: "vote_updated"; votePayload: TeamVoteUpdatedPayload }>
  | Readonly<{
      followUp: TurnFollowUpResult;
      resolvedPayload: TeamVoteResolvedPayload;
      type: "vote_resolved";
    }>;

// ---------------------------------------------------------------------------
// Shared helper functions
// ---------------------------------------------------------------------------

/** Revalidate the game page so the next server render picks up updated state. */
export function revalidateGamePath(sessionId: string): void {
  revalidatePath(`/play/game/${sessionId}`);
}

/** Restore a game player's score, timeline, or tokens after a failed DB write. */
export async function restoreGamePlayerState(
  serviceClient: ServiceClient,
  sessionId: string,
  userId: string,
  fields: Readonly<{
    score?: number;
    timeline?: readonly TimelineEntry[];
    tokens?: number;
  }>,
): Promise<boolean> {
  const payload: {
    score?: number;
    timeline?: Json;
    tokens?: number;
  } = {};
  if (fields.score !== undefined) {
    payload["score"] = fields.score;
  }
  if (fields.timeline !== undefined) {
    payload["timeline"] = fields.timeline as unknown as Json;
  }
  if (fields.tokens !== undefined) {
    payload["tokens"] = fields.tokens;
  }

  const { error } = await serviceClient
    .from("game_players")
    .update(payload)
    .eq("game_session_id", sessionId)
    .eq("user_id", userId);

  return error === null;
}

/** Restore a player's challenge token after a failed turn update. */
export async function restoreChallengeToken(
  serviceClient: ServiceClient,
  sessionId: string,
  userId: string,
  tokens: number,
): Promise<boolean> {
  return restoreGamePlayerState(serviceClient, sessionId, userId, { tokens });
}

/** Strip the phase deadline and mark a turn as complete. */
export function buildCompletedTurn(
  turn: TurnState,
  extraFields: Partial<TurnState> = {},
): TurnState {
  const { phaseDeadline, ...rest } = turn;
  void phaseDeadline;
  return {
    ...rest,
    ...extraFields,
    phase: "complete",
  };
}

/** Verify the calling user is a member of the given game session. */
export async function ensureSessionMember(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<Result<true, AppError>> {
  const { data, error } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to verify your game session membership."));
  }

  return data === null
    ? fail(appError("NOT_FOUND", "That game session no longer exists."))
    : ok(true);
}
