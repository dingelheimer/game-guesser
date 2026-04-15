// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { checkPlatformGuess } from "@/lib/platformBonus";
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
  SubmitPlatformBonusSchema,
  type ProceedFromPlatformBonusResult,
  type ServiceClient,
  type SubmitPlatformBonusResult,
  type WritableGameSession,
} from "./gameActionTypes";
import { loadBoardState, loadWritableGamePlayer, loadWritableGameSession } from "./gameDataLoaders";
import { loadPlatformBonusState } from "./platformBonusDataLoader";
import { buildFollowUpAfterReveal } from "./turnLifecycle";

/** Resolve the platform bonus phase after a correct or incorrect answer. */
async function resolvePlatformBonusPhase(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  correct: boolean,
): Promise<Result<SubmitPlatformBonusResult, AppError>> {
  const platformBonusStateResult = await loadPlatformBonusState(
    serviceClient,
    session.currentTurn.gameId,
  );
  if (!platformBonusStateResult.success) {
    return platformBonusStateResult;
  }

  const isProVariant = session.settings.variant === "pro";
  const platformBonusPlayerId = session.currentTurn.platformBonusPlayerId ?? session.activePlayerId;
  let tokenChange = 0;
  let rollbackState: Readonly<{
    fields: Readonly<{
      score?: number;
      timeline?: readonly TimelineEntry[];
      tokens?: number;
    }>;
    userId: string;
  }> | null = null;

  if (correct && !isProVariant) {
    const activePlayerResult = await loadWritableGamePlayer(
      serviceClient,
      sessionId,
      platformBonusPlayerId,
    );
    if (!activePlayerResult.success) {
      return activePlayerResult;
    }

    const nextTokens = Math.min(5, activePlayerResult.data.tokens + 1);
    tokenChange = nextTokens - activePlayerResult.data.tokens;

    if (tokenChange > 0) {
      rollbackState = {
        fields: { tokens: activePlayerResult.data.tokens },
        userId: activePlayerResult.data.userId,
      };
      const { error: updateTokenError } = await serviceClient
        .from("game_players")
        .update({ tokens: nextTokens })
        .eq("game_session_id", sessionId)
        .eq("user_id", platformBonusPlayerId);

      if (updateTokenError !== null) {
        return fail(appError("INTERNAL_ERROR", "Failed to award the platform bonus token."));
      }
    }
  } else if (!correct && isProVariant) {
    const platformBonusPlayerResult = await loadWritableGamePlayer(
      serviceClient,
      sessionId,
      platformBonusPlayerId,
    );
    if (!platformBonusPlayerResult.success) {
      return platformBonusPlayerResult;
    }

    const updatedTimeline = platformBonusPlayerResult.data.timeline.filter(
      (entry) => entry.gameId !== session.currentTurn.gameId,
    );
    const updatedScore = Math.max(0, platformBonusPlayerResult.data.score - 1);
    rollbackState = {
      fields: {
        score: platformBonusPlayerResult.data.score,
        timeline: platformBonusPlayerResult.data.timeline,
      },
      userId: platformBonusPlayerResult.data.userId,
    };

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({
        score: updatedScore,
        timeline: updatedTimeline as unknown as Json,
      })
      .eq("game_session_id", sessionId)
      .eq("user_id", platformBonusPlayerId);

    if (updatePlayerError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to apply the PRO platform bonus penalty."));
    }
  }

  const completedTurn = buildCompletedTurn(session.currentTurn, {
    platformBonusCorrect: correct,
  });
  const { data: updatedSession, error: updateTurnError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: completedTurn as unknown as Json,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "platform_bonus")
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
    return fail(appError("INTERNAL_ERROR", "Failed to store the platform bonus result."));
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
    return fail(appError("CONFLICT", "Another player already advanced this platform bonus."));
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
    bonus: {
      correct,
      correctPlatforms: platformBonusStateResult.data.correctPlatforms,
      scores: boardResult.data.scores,
      timelines: boardResult.data.timelines,
      tokenChange,
      tokens: boardResult.data.tokens,
    },
    followUp: followUpResult.data,
  });
}

/**
 * Validate the active player's platform selections and resolve the bonus phase.
 */
export async function submitPlatformBonus(
  sessionId: string,
  selectedPlatformIds: readonly number[],
): Promise<Result<SubmitPlatformBonusResult, AppError>> {
  const parsed = SubmitPlatformBonusSchema.safeParse({ selectedPlatformIds, sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please choose a valid platform bonus selection."));
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

  if (sessionResult.data.currentTurn.phase !== "platform_bonus") {
    return fail(appError("CONFLICT", "This multiplayer turn is not accepting platform guesses."));
  }

  const platformBonusPlayerId =
    sessionResult.data.currentTurn.platformBonusPlayerId ?? sessionResult.data.activePlayerId;
  if (platformBonusPlayerId !== userIdResult.data) {
    return fail(
      appError("UNAUTHORIZED", "Only the designated player can answer the platform bonus."),
    );
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() <= Date.now()
  ) {
    return fail(appError("CONFLICT", "The multiplayer platform bonus has already expired."));
  }

  const platformBonusStateResult = await loadPlatformBonusState(
    serviceClient,
    sessionResult.data.currentTurn.gameId,
  );
  if (!platformBonusStateResult.success) {
    return platformBonusStateResult;
  }

  const correctSelection =
    checkPlatformGuess(
      parsed.data.selectedPlatformIds,
      platformBonusStateResult.data.correctIds,
    ) === "correct";
  const bonusResult = await resolvePlatformBonusPhase(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
    correctSelection,
  );
  if (!bonusResult.success) {
    return bonusResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok(bonusResult.data);
}

/**
 * Resolve an expired platform bonus phase without awarding a token.
 */
export async function proceedFromPlatformBonus(
  sessionId: string,
): Promise<Result<ProceedFromPlatformBonusResult, AppError>> {
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

  if (sessionResult.data.currentTurn.phase !== "platform_bonus") {
    return fail(appError("CONFLICT", "This multiplayer turn is not waiting on a platform bonus."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() > Date.now()
  ) {
    return fail(appError("CONFLICT", "The multiplayer platform bonus has not expired yet."));
  }

  const bonusResult = await resolvePlatformBonusPhase(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
    false,
  );
  if (!bonusResult.success) {
    return bonusResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok(bonusResult.data);
}
