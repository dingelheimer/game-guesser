// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";
import { getAuthenticatedUserId } from "./actionHelpers";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import type { TurnState } from "./deck";
import {
  ensureSessionMember,
  revalidateGamePath,
  restoreChallengeToken,
  SessionIdSchema,
  SubmitPlacementSchema,
  type ProceedFromChallengeResult,
  type SubmitChallengeResult,
  type SubmitPlacementResult,
} from "./gameActionTypes";
import { loadWritableGamePlayer, loadWritableGameSession } from "./gameDataLoaders";
import { resolveTurn } from "./turnActions";
import { buildChallengeDeadline } from "./turns";

/**
 * Submit the active player's multiplayer placement and either open the challenge
 * window or immediately reveal the result.
 */
export async function submitPlacement(
  sessionId: string,
  position: number,
): Promise<Result<SubmitPlacementResult, AppError>> {
  const parsed = SubmitPlacementSchema.safeParse({ position, sessionId });
  if (!parsed.success) {
    return fail(
      appError("VALIDATION_ERROR", "Please choose a valid placement before submitting your turn."),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.activePlayerId !== userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "Only the active player can place this card."));
  }

  if (sessionResult.data.currentTurn.phase !== "placing") {
    return fail(appError("CONFLICT", "This multiplayer turn is no longer accepting placements."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline !== undefined &&
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() <= Date.now()
  ) {
    return fail(
      appError("CONFLICT", "The multiplayer turn timer expired before you placed the card."),
    );
  }

  const playerResult = await loadWritableGamePlayer(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data.activePlayerId,
  );
  if (!playerResult.success) {
    return playerResult;
  }

  if (parsed.data.position > playerResult.data.timeline.length) {
    return fail(appError("VALIDATION_ERROR", "That placement position is out of range."));
  }

  const updatedTurn: TurnState = {
    ...sessionResult.data.currentTurn,
    placedPosition: parsed.data.position,
    ...(sessionResult.data.settings.tokensEnabled
      ? {
          phase: "challenge_window" as const,
          phaseDeadline: buildChallengeDeadline(),
        }
      : {
          phase: "revealing" as const,
        }),
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: updatedTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("active_player_id", userIdResult.data)
    .eq("current_turn->>phase", "placing")
    .select("room_id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to save that multiplayer placement."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This multiplayer turn was already submitted."));
  }

  const placementPayload = {
    activePlayerId: userIdResult.data,
    ...(updatedTurn.phaseDeadline !== undefined
      ? { challengeDeadline: updatedTurn.phaseDeadline }
      : {}),
    position: parsed.data.position,
  };

  if (sessionResult.data.settings.tokensEnabled) {
    revalidateGamePath(parsed.data.sessionId);
    return ok({
      placement: placementPayload,
      type: "challenge_window",
    });
  }

  const revealResult = await resolveTurn(parsed.data.sessionId);
  if (!revealResult.success) {
    return revealResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    type: "revealed",
    ...(revealResult.data.followUp === undefined ? {} : { followUp: revealResult.data.followUp }),
    placement: placementPayload,
    reveal: revealResult.data.reveal,
  });
}

/**
 * Spend one token to challenge the current placement and immediately reveal it.
 */
export async function submitChallenge(
  sessionId: string,
): Promise<Result<SubmitChallengeResult, AppError>> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "challenge_window") {
    return fail(appError("CONFLICT", "This multiplayer turn cannot be challenged right now."));
  }

  if (sessionResult.data.activePlayerId === userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "You cannot challenge your own placement."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() <= Date.now()
  ) {
    return fail(appError("CONFLICT", "The challenge window has already expired."));
  }

  if (sessionResult.data.currentTurn.challengerId !== undefined) {
    return fail(appError("CONFLICT", "Another player already challenged this placement."));
  }

  const challengerResult = await loadWritableGamePlayer(
    serviceClient,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!challengerResult.success) {
    return challengerResult;
  }

  if (challengerResult.data.tokens < 1) {
    return fail(appError("CONFLICT", "You need at least one token to challenge a placement."));
  }

  const { error: tokenError } = await serviceClient
    .from("game_players")
    .update({ tokens: challengerResult.data.tokens - 1 })
    .eq("game_session_id", parsed.data.sessionId)
    .eq("user_id", userIdResult.data)
    .gte("tokens", 1);

  if (tokenError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to spend your challenge token."));
  }

  const updatedTurn: TurnState = {
    ...sessionResult.data.currentTurn,
    challengerId: userIdResult.data,
    phase: "revealing",
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: updatedTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("current_turn->>phase", "challenge_window")
    .is("current_turn->challengerId", null)
    .select("id")
    .maybeSingle();

  if (updateError !== null) {
    const refunded = await restoreChallengeToken(
      serviceClient,
      parsed.data.sessionId,
      userIdResult.data,
      challengerResult.data.tokens,
    );
    return refunded
      ? fail(appError("INTERNAL_ERROR", "Failed to register your multiplayer challenge."))
      : fail(appError("INTERNAL_ERROR", "Failed to register the challenge and refund the token."));
  }

  if (updatedSession === null) {
    const refunded = await restoreChallengeToken(
      serviceClient,
      parsed.data.sessionId,
      userIdResult.data,
      challengerResult.data.tokens,
    );
    return refunded
      ? fail(appError("CONFLICT", "Another player already moved this multiplayer turn forward."))
      : fail(
          appError(
            "INTERNAL_ERROR",
            "The challenge window closed before your token could be refunded.",
          ),
        );
  }

  const revealResult = await resolveTurn(parsed.data.sessionId);
  if (!revealResult.success) {
    return revealResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    challenge: {
      challengerId: userIdResult.data,
      displayName: challengerResult.data.displayName,
    },
    ...(revealResult.data.followUp === undefined ? {} : { followUp: revealResult.data.followUp }),
    reveal: revealResult.data.reveal,
  });
}

/**
 * Advance a multiplayer challenge window with no challenger into the reveal phase.
 */
export async function proceedFromChallenge(
  sessionId: string,
): Promise<Result<ProceedFromChallengeResult, AppError>> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "challenge_window") {
    return fail(appError("CONFLICT", "This multiplayer turn is not waiting for a challenge."));
  }

  if (sessionResult.data.currentTurn.challengerId !== undefined) {
    return fail(appError("CONFLICT", "A player already challenged this placement."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() > Date.now()
  ) {
    return fail(appError("CONFLICT", "The challenge window has not expired yet."));
  }

  const updatedTurn: TurnState = {
    ...sessionResult.data.currentTurn,
    phase: "revealing",
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: updatedTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("current_turn->>phase", "challenge_window")
    .is("current_turn->challengerId", null)
    .select("id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to continue from the challenge window."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "Another player already advanced this multiplayer turn."));
  }

  const revealResult = await resolveTurn(parsed.data.sessionId);
  if (!revealResult.success) {
    return revealResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    ...(revealResult.data.followUp === undefined ? {} : { followUp: revealResult.data.followUp }),
    reveal: revealResult.data.reveal,
  });
}

export { acceptChallenge } from "./acceptChallengeAction";
