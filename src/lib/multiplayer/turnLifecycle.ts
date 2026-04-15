// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import type { Json } from "@/types/supabase";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import type { TimelineEntry, TurnState } from "./deck";
import {
  ScreenshotRowSchema,
  type ServiceClient,
  type TurnFollowUpResult,
  type WritableGamePlayer,
  type WritableGameSession,
} from "./gameActionTypes";
import { loadBoardState } from "./gameDataLoaders";
import { finishGame, finishTeamworkGame } from "./gameOverActions";
import { sortPlayersByStanding } from "./rankings";
import { buildPhaseDeadline, getNextTurnIndex, type TurnStartedPayload } from "./turns";

/** Advance to the next turn by loading a screenshot and writing the new turn state. */
export async function startNextTurn(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  expectedPhase: TurnState["phase"],
): Promise<Result<TurnStartedPayload, AppError>> {
  const nextTurnIndex = getNextTurnIndex(session.turnOrder, session.activePlayerId);
  const nextGameId = session.deck.at(session.deckCursor);
  if (nextTurnIndex === null || nextGameId === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to prepare the next multiplayer turn."));
  }

  const nextActivePlayerId = session.turnOrder[nextTurnIndex];
  if (nextActivePlayerId === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to find the next active player."));
  }

  const { data: screenshotRows, error: screenshotError } = await serviceClient
    .from("screenshots")
    .select("igdb_image_id")
    .eq("game_id", nextGameId)
    .neq("curation", "rejected")
    .order("sort_order", { ascending: true })
    .limit(1);

  if (screenshotError !== null || screenshotRows.length === 0) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the next multiplayer screenshot."));
  }

  const screenshot = ScreenshotRowSchema.safeParse(screenshotRows[0]);
  if (!screenshot.success) {
    return fail(
      appError("INTERNAL_ERROR", "Encountered an invalid multiplayer screenshot payload."),
    );
  }

  const deadline = buildPhaseDeadline(session.settings.turnTimer);
  const isTeamworkMultiplayer =
    session.settings.gameMode === "teamwork" && session.turnOrder.length > 1;
  const nextPhase: TurnState["phase"] = isTeamworkMultiplayer ? "team_voting" : "placing";
  const nextTurn: TurnState = {
    activePlayerId: nextActivePlayerId,
    gameId: nextGameId,
    phase: nextPhase,
    screenshotImageId: screenshot.data.igdb_image_id,
    ...(isTeamworkMultiplayer && { votes: {} }),
    ...(deadline !== null && { phaseDeadline: deadline }),
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      active_player_id: nextActivePlayerId,
      current_turn: nextTurn as unknown as Json,
      deck_cursor: session.deckCursor + 1,
      turn_number: session.turnNumber + 1,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", expectedPhase)
    .select("room_id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to advance to the next multiplayer turn."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This multiplayer turn has already moved on."));
  }

  return ok({
    activePlayerId: nextActivePlayerId,
    deadline,
    screenshot: { screenshotImageId: screenshot.data.igdb_image_id },
    turnNumber: session.turnNumber + 1,
  });
}

/** Determine follow-up after a team vote resolves: game over or next turn. */
export async function buildFollowUpAfterTeamVote(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  teamScore: number,
  teamTimeline: readonly TimelineEntry[],
  teamTokens: number,
): Promise<Result<TurnFollowUpResult, AppError>> {
  if (teamTokens <= 0) {
    const gameOverResult = await finishTeamworkGame(
      serviceClient,
      sessionId,
      session,
      false,
      teamScore,
      teamTimeline,
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({ gameOver: gameOverResult.data, type: "team_game_over" });
  }

  if (teamScore >= session.settings.winCondition) {
    const gameOverResult = await finishTeamworkGame(
      serviceClient,
      sessionId,
      session,
      true,
      teamScore,
      teamTimeline,
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({ gameOver: gameOverResult.data, type: "team_game_over" });
  }

  if (session.deckCursor >= session.deck.length) {
    const gameOverResult = await finishTeamworkGame(
      serviceClient,
      sessionId,
      session,
      false,
      teamScore,
      teamTimeline,
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({ gameOver: gameOverResult.data, type: "team_game_over" });
  }

  const nextTurnResult = await startNextTurn(serviceClient, sessionId, session, "complete");
  if (!nextTurnResult.success) {
    return nextTurnResult;
  }

  return ok({ nextTurn: nextTurnResult.data, type: "next_turn" });
}

/** Determine follow-up after a reveal: win check, deck exhaustion, or next turn. */
export async function buildFollowUpAfterReveal(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  players: readonly WritableGamePlayer[],
): Promise<Result<TurnFollowUpResult, AppError>> {
  const activePlayer = players.find((player) => player.userId === session.activePlayerId);
  if (activePlayer === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the active player's final score."));
  }

  const winnerByScore =
    activePlayer.score >= session.settings.winCondition
      ? activePlayer
      : (players.find(
          (player) =>
            player.userId !== session.activePlayerId &&
            player.score >= session.settings.winCondition,
        ) ?? null);

  if (winnerByScore !== null) {
    const gameOverResult = await finishGame(
      serviceClient,
      sessionId,
      session,
      players,
      winnerByScore.userId,
      "complete",
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({ gameOver: gameOverResult.data, type: "game_over" });
  }

  if (session.deckCursor >= session.deck.length) {
    const winner = sortPlayersByStanding(players)[0];
    if (winner === undefined) {
      return fail(appError("INTERNAL_ERROR", "Failed to determine the multiplayer winner."));
    }

    const gameOverResult = await finishGame(
      serviceClient,
      sessionId,
      session,
      players,
      winner.userId,
      "complete",
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({ gameOver: gameOverResult.data, type: "game_over" });
  }

  const nextTurnResult = await startNextTurn(serviceClient, sessionId, session, "complete");
  if (!nextTurnResult.success) {
    return nextTurnResult;
  }

  return ok({ nextTurn: nextTurnResult.data, type: "next_turn" });
}

/** Determine follow-up after a skip: deck exhaustion check or next turn. */
export async function buildFollowUpAfterSkip(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
): Promise<Result<TurnFollowUpResult, AppError>> {
  if (session.deckCursor >= session.deck.length) {
    const boardResult = await loadBoardState(serviceClient, sessionId);
    if (!boardResult.success) {
      return boardResult;
    }

    const winner = sortPlayersByStanding(boardResult.data.players)[0];
    if (winner === undefined) {
      return fail(appError("INTERNAL_ERROR", "Failed to determine the multiplayer winner."));
    }

    const gameOverResult = await finishGame(
      serviceClient,
      sessionId,
      session,
      boardResult.data.players,
      winner.userId,
      "placing",
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({ gameOver: gameOverResult.data, type: "game_over" });
  }

  const nextTurnResult = await startNextTurn(serviceClient, sessionId, session, "placing");
  if (!nextTurnResult.success) {
    return nextTurnResult;
  }

  return ok({ nextTurn: nextTurnResult.data, type: "next_turn" });
}
