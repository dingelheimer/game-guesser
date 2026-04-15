// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import type { Json } from "@/types/supabase";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import type { TimelineEntry, TurnState } from "./deck";
import {
  buildCompletedTurn,
  type ServiceClient,
  type WritableGamePlayer,
  type WritableGameSession,
} from "./gameActionTypes";
import type { GameOverPayload, TeamGameOverPayload } from "./turns";

/** Build the game-over payload with final scores and timelines for all players. */
export function buildGameOverPayload(
  players: readonly WritableGamePlayer[],
  winnerId: string,
): Result<GameOverPayload, AppError> {
  const winner = players.find((player) => player.userId === winnerId);
  if (winner === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to find the winner for this multiplayer game."));
  }

  const finalScores: Record<string, number> = {};
  const finalTimelines: Record<string, readonly TimelineEntry[]> = {};
  for (const player of players) {
    finalScores[player.userId] = player.score;
    finalTimelines[player.userId] = player.timeline;
  }

  return ok({
    displayName: winner.displayName,
    finalScores,
    finalTimelines,
    winnerId: winner.userId,
  });
}

/** Mark the game session and room as finished with the given winner. */
export async function finishGame(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  players: readonly WritableGamePlayer[],
  winnerId: string,
  expectedPhase: TurnState["phase"],
): Promise<Result<GameOverPayload, AppError>> {
  const payloadResult = buildGameOverPayload(players, winnerId);
  if (!payloadResult.success) {
    return payloadResult;
  }

  const completedTurn = buildCompletedTurn(session.currentTurn);
  const { data: updatedSession, error: sessionError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: completedTurn as unknown as Json,
      status: "finished",
      winner_id: winnerId,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("status", "active")
    .eq("current_turn->>phase", expectedPhase)
    .select("id")
    .maybeSingle();

  if (sessionError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to finish the multiplayer game session."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This multiplayer game has already finished."));
  }

  const { data: updatedRoom, error: roomError } = await serviceClient
    .from("rooms")
    .update({ status: "finished" })
    .eq("id", session.roomId)
    .select("id")
    .maybeSingle();

  if (roomError !== null || updatedRoom === null) {
    return fail(appError("INTERNAL_ERROR", "Failed to finish the multiplayer room."));
  }

  return ok(payloadResult.data);
}

/** Mark a TEAMWORK game session as finished with an optional winner. */
export async function finishTeamworkGame(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  teamWin: boolean,
  teamScore: number,
  teamTimeline: readonly TimelineEntry[],
): Promise<Result<TeamGameOverPayload, AppError>> {
  const winnerId = teamWin ? (session.turnOrder[0] ?? null) : null;

  const completedTurn = buildCompletedTurn(session.currentTurn);
  const { data: updatedSession, error: sessionError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: completedTurn as unknown as Json,
      status: "finished",
      winner_id: winnerId,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (sessionError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to finish the multiplayer game session."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This multiplayer game has already finished."));
  }

  const { data: updatedRoom, error: roomError } = await serviceClient
    .from("rooms")
    .update({ status: "finished" })
    .eq("id", session.roomId)
    .select("id")
    .maybeSingle();

  if (roomError !== null || updatedRoom === null) {
    return fail(appError("INTERNAL_ERROR", "Failed to finish the multiplayer room."));
  }

  return ok({
    finalTeamScore: teamScore,
    finalTeamTimeline: teamTimeline,
    teamWin,
  });
}
