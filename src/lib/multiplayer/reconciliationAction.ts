// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PlatformOptionSchema } from "@/lib/platformBonus";
import { type TurnPhaseSchema, TurnStateSchema, TimelineEntrySchema } from "./deck";
import { GamePlayerRowSchema, GameSessionRowSchema } from "./gamePageSchemas";

const ReconciliationTimelineEntrySchema = z.object({
  gameId: z.number().int(),
  name: z.string(),
  releaseYear: z.number().int(),
});

/**
 * Lightweight per-player snapshot used for DB reconciliation.
 */
export type ReconciliationPlayer = Readonly<{
  score: number;
  timeline: ReadonlyArray<Readonly<{ gameId: number; name: string; releaseYear: number }>>;
  tokens: number;
  userId: string;
}>;

/**
 * Minimal game-state snapshot returned by the reconciliation server action.
 * Contains only the fields needed to detect and repair stale client state.
 * The deck is never included — `game_sessions_safe` filters it out.
 */
export type ReconciliationPayload = Readonly<{
  currentTurn: Readonly<{
    activePlayerId: string;
    gameId: number;
    phase: z.infer<typeof TurnPhaseSchema>;
    phaseDeadline: string | null;
    platformBonusPlayerId?: string;
    platformOptions: ReadonlyArray<Readonly<{ id: number; name: string }>>;
    screenshotImageId: string;
    votes?: Readonly<Record<string, Readonly<{ locked: boolean; position: number }>>>;
  }>;
  players: readonly ReconciliationPlayer[];
  status: "active" | "finished";
  turnNumber: number;
  winnerId: string | null;
}>;

/**
 * Fetch a lightweight snapshot of the current game state for periodic reconciliation.
 * Uses `game_sessions_safe` (RLS-protected, no deck exposure) and `game_players`.
 * Returns `null` when the session cannot be loaded or the user is not authenticated.
 */
export async function fetchReconciliationState(
  sessionId: string,
): Promise<ReconciliationPayload | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError !== null || user === null) {
    return null;
  }

  const [{ data: sessionRow, error: sessionError }, { data: playerRows, error: playersError }] =
    await Promise.all([
      supabase
        .from("game_sessions_safe")
        .select("id, status, current_turn, turn_number, active_player_id, winner_id, settings")
        .eq("id", sessionId)
        .maybeSingle(),
      supabase
        .from("game_players")
        .select("user_id, score, tokens, timeline")
        .eq("game_session_id", sessionId),
    ]);

  if (sessionError !== null || sessionRow === null || playersError !== null) {
    return null;
  }

  const session = GameSessionRowSchema.safeParse(sessionRow);
  if (!session.success) {
    return null;
  }

  if (session.data.status !== "active" && session.data.status !== "finished") {
    return null;
  }

  if (session.data.turn_number === null || session.data.current_turn === null) {
    return null;
  }

  const currentTurn = TurnStateSchema.safeParse(session.data.current_turn);
  if (!currentTurn.success) {
    return null;
  }

  const players: ReconciliationPlayer[] = [];
  for (const row of playerRows) {
    const player = GamePlayerRowSchema.safeParse(row);
    const timeline = z.array(TimelineEntrySchema).safeParse(row.timeline);
    if (!player.success || !timeline.success) {
      return null;
    }

    players.push({
      score: player.data.score,
      timeline: timeline.data.map((entry) => ReconciliationTimelineEntrySchema.parse(entry)),
      tokens: player.data.tokens,
      userId: player.data.user_id,
    });
  }

  const platformOptions = (currentTurn.data.platformOptions ?? []).map((opt) =>
    PlatformOptionSchema.parse(opt),
  );

  return {
    currentTurn: {
      activePlayerId: currentTurn.data.activePlayerId,
      gameId: currentTurn.data.gameId,
      phase: currentTurn.data.phase,
      phaseDeadline: currentTurn.data.phaseDeadline ?? null,
      ...(currentTurn.data.platformBonusPlayerId !== undefined
        ? { platformBonusPlayerId: currentTurn.data.platformBonusPlayerId }
        : {}),
      platformOptions,
      screenshotImageId: currentTurn.data.screenshotImageId,
      ...(currentTurn.data.votes !== undefined ? { votes: currentTurn.data.votes } : {}),
    },
    players,
    status: session.data.status,
    turnNumber: session.data.turn_number,
    winnerId: session.data.winner_id,
  };
}
