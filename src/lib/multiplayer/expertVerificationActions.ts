// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import type { PlatformOption } from "@/lib/platformBonus";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";
import { getAuthenticatedUserId } from "./actionHelpers";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import type { TimelineEntry } from "./deck";
import {
  buildCompletedTurn,
  ensureSessionMember,
  restoreGamePlayerState,
  revalidateGamePath,
  SessionIdSchema,
  SubmitExpertVerificationSchema,
  type ProceedFromExpertVerificationResult,
  type ServiceClient,
  type SubmitExpertVerificationResult,
  type WritableGameSession,
} from "./gameActionTypes";
import { loadBoardState, loadWritableGamePlayer, loadWritableGameSession } from "./gameDataLoaders";
import { loadPlatformBonusState } from "./platformBonusDataLoader";
import { buildFollowUpAfterReveal } from "./turnLifecycle";

/** Resolve the expert verification phase with the given year/platform correctness. */
async function resolveExpertVerificationPhase(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  yearCorrect: boolean,
  platformsCorrect: boolean,
  correctPlatforms: readonly PlatformOption[],
): Promise<Result<SubmitExpertVerificationResult, AppError>> {
  const correct = yearCorrect && platformsCorrect;
  const expertPlayerId = session.currentTurn.platformBonusPlayerId ?? session.activePlayerId;
  let rollbackState: Readonly<{
    fields: Readonly<{ score?: number; timeline?: readonly TimelineEntry[] }>;
    userId: string;
  }> | null = null;

  if (!correct) {
    const expertPlayerResult = await loadWritableGamePlayer(
      serviceClient,
      sessionId,
      expertPlayerId,
    );
    if (!expertPlayerResult.success) {
      return expertPlayerResult;
    }

    const updatedTimeline = expertPlayerResult.data.timeline.filter(
      (entry) => entry.gameId !== session.currentTurn.gameId,
    );
    const updatedScore = Math.max(0, expertPlayerResult.data.score - 1);
    rollbackState = {
      fields: {
        score: expertPlayerResult.data.score,
        timeline: expertPlayerResult.data.timeline,
      },
      userId: expertPlayerResult.data.userId,
    };

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({
        score: updatedScore,
        timeline: updatedTimeline as unknown as Json,
      })
      .eq("game_session_id", sessionId)
      .eq("user_id", expertPlayerId);

    if (updatePlayerError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to apply the EXPERT verification penalty."));
    }
  }

  const completedTurn = buildCompletedTurn(session.currentTurn);
  const { data: updatedSession, error: updateTurnError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: completedTurn as unknown as Json,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "expert_verification")
    .select("id")
    .maybeSingle();

  if (updateTurnError !== null) {
    if (rollbackState !== null) {
      await restoreGamePlayerState(
        serviceClient,
        sessionId,
        rollbackState.userId,
        rollbackState.fields,
      );
    }
    return fail(appError("INTERNAL_ERROR", "Failed to store the expert verification result."));
  }

  if (updatedSession === null) {
    if (rollbackState !== null) {
      await restoreGamePlayerState(
        serviceClient,
        sessionId,
        rollbackState.userId,
        rollbackState.fields,
      );
    }
    return fail(appError("CONFLICT", "Another player already advanced this expert verification."));
  }

  const boardResult = await loadBoardState(serviceClient, sessionId);
  if (!boardResult.success) {
    return boardResult;
  }

  const followUpResult = await buildFollowUpAfterReveal(
    serviceClient,
    sessionId,
    session,
    boardResult.data.players,
  );
  if (!followUpResult.success) {
    return followUpResult;
  }

  return ok({
    verification: {
      correct,
      correctPlatforms,
      platformsCorrect,
      scores: boardResult.data.scores,
      timelines: boardResult.data.timelines,
      tokens: boardResult.data.tokens,
      yearCorrect,
    },
    followUp: followUpResult.data,
  });
}

/**
 * Submit a player's expert verification answer (year + platforms) for a
 * multiplayer EXPERT variant turn.
 */
export async function submitExpertVerification(
  sessionId: string,
  yearGuess: number,
  selectedPlatformIds: readonly number[],
): Promise<Result<SubmitExpertVerificationResult, AppError>> {
  const parsed = SubmitExpertVerificationSchema.safeParse({
    selectedPlatformIds: [...selectedPlatformIds],
    sessionId,
    yearGuess,
  });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid expert verification answer."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "expert_verification") {
    return fail(
      appError("CONFLICT", "This multiplayer turn is not waiting on expert verification."),
    );
  }

  const expertPlayerId =
    sessionResult.data.currentTurn.platformBonusPlayerId ?? sessionResult.data.activePlayerId;
  if (userIdResult.data !== expertPlayerId) {
    return fail(
      appError("UNAUTHORIZED", "Only the designated player may submit expert verification."),
    );
  }

  const gameId = sessionResult.data.currentTurn.gameId;

  const { data: gameRows, error: gameError } = await serviceClient
    .from("games")
    .select("release_year")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError !== null || gameRows === null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the game release year."));
  }

  const platformBonusStateResult = await loadPlatformBonusState(
    serviceClient,
    gameId,
    gameRows.release_year,
  );
  if (!platformBonusStateResult.success) {
    return platformBonusStateResult;
  }

  const yearCorrect = parsed.data.yearGuess === gameRows.release_year;
  const correctPlatformIds = new Set(
    platformBonusStateResult.data.correctPlatforms.map((p) => p.id),
  );
  const selectedSet = new Set(parsed.data.selectedPlatformIds);
  const platformsCorrect =
    correctPlatformIds.size === selectedSet.size &&
    [...correctPlatformIds].every((id) => selectedSet.has(id));

  const verifyResult = await resolveExpertVerificationPhase(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
    yearCorrect,
    platformsCorrect,
    platformBonusStateResult.data.correctPlatforms,
  );
  if (!verifyResult.success) {
    return verifyResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok(verifyResult.data);
}

/**
 * Advance past an expired expert verification phase (timeout = incorrect).
 */
export async function proceedFromExpertVerification(
  sessionId: string,
): Promise<Result<ProceedFromExpertVerificationResult, AppError>> {
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

  if (sessionResult.data.currentTurn.phase !== "expert_verification") {
    return fail(
      appError("CONFLICT", "This multiplayer turn is not waiting on expert verification."),
    );
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() > Date.now()
  ) {
    return fail(appError("CONFLICT", "The expert verification phase has not expired yet."));
  }

  const gameId = sessionResult.data.currentTurn.gameId;

  const { data: gameRows, error: gameError } = await serviceClient
    .from("games")
    .select("release_year")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError !== null || gameRows === null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the game release year."));
  }

  const platformBonusStateResult = await loadPlatformBonusState(
    serviceClient,
    gameId,
    gameRows.release_year,
  );

  const verifyResult = await resolveExpertVerificationPhase(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
    false,
    false,
    platformBonusStateResult.success ? platformBonusStateResult.data.correctPlatforms : [],
  );
  if (!verifyResult.success) {
    return verifyResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok(verifyResult.data);
}
