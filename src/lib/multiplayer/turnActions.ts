// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";
import { getAuthenticatedUserId } from "./actionHelpers";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import type { TurnState } from "./deck";
import {
  buildCompletedTurn,
  ensureSessionMember,
  revalidateGamePath,
  SessionIdSchema,
  SkipTurnSchema,
  type ResolveTurnResult,
  type SkipTurnResult,
} from "./gameActionTypes";
import {
  loadBoardState,
  loadResolvedTurnCard,
  loadWritableGamePlayer,
  loadWritableGameSession,
} from "./gameDataLoaders";
import { loadPlatformBonusState } from "./platformBonusDataLoader";
import { buildFollowUpAfterReveal, buildFollowUpAfterSkip } from "./turnLifecycle";
import {
  buildExpertVerificationDeadline,
  buildPlatformBonusDeadline,
  findTimelineInsertPosition,
  insertTimelineEntry,
  isPlacementCorrect,
  type ChallengeResult,
} from "./turns";

/**
 * Resolve the already-recorded multiplayer placement and return the reveal payload.
 */
export async function resolveTurn(sessionId: string): Promise<Result<ResolveTurnResult, AppError>> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }
  const sid = parsed.data.sessionId;

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }
  const membershipResult = await ensureSessionMember(supabase, sid, userIdResult.data);
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, sid);
  if (!sessionResult.success) {
    return sessionResult;
  }
  const session = sessionResult.data;

  if (
    session.currentTurn.phase !== "revealing" ||
    session.currentTurn.placedPosition === undefined
  ) {
    return fail(appError("CONFLICT", "This multiplayer turn is not ready to reveal."));
  }

  const [playerResult, cardResult] = await Promise.all([
    loadWritableGamePlayer(serviceClient, sid, session.activePlayerId),
    loadResolvedTurnCard(serviceClient, session.currentTurn),
  ]);
  if (!playerResult.success) {
    return playerResult;
  }
  if (!cardResult.success) {
    return cardResult;
  }

  const isCorrect = isPlacementCorrect(
    playerResult.data.timeline,
    cardResult.data.releaseYear,
    session.currentTurn.placedPosition,
  );
  const challengerId = session.currentTurn.challengerId;
  const isStandardVariant = session.settings.variant === "standard";
  const isProVariant = session.settings.variant === "pro";
  const isExpertVariant = session.settings.variant === "expert";
  let challengeResult: ChallengeResult | undefined;
  let platformBonusPlayerId: string | undefined;

  if (isCorrect) {
    const updatedTimeline = insertTimelineEntry(
      playerResult.data.timeline,
      {
        gameId: cardResult.data.gameId,
        name: cardResult.data.name,
        releaseYear: cardResult.data.releaseYear,
      },
      session.currentTurn.placedPosition,
    );

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({
        score: playerResult.data.score + 1,
        timeline: updatedTimeline as unknown as Json,
      })
      .eq("game_session_id", sid)
      .eq("user_id", playerResult.data.userId);

    if (updatePlayerError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to save the resolved multiplayer turn."));
    }

    platformBonusPlayerId = session.activePlayerId;
    if (challengerId !== undefined) {
      challengeResult = "challenger_loses";
    }
  } else if (challengerId !== undefined) {
    const challengerResult = await loadWritableGamePlayer(serviceClient, sid, challengerId);
    if (!challengerResult.success) {
      return challengerResult;
    }

    const challengerInsertPosition = findTimelineInsertPosition(
      challengerResult.data.timeline,
      cardResult.data.releaseYear,
    );
    const updatedTimeline = insertTimelineEntry(
      challengerResult.data.timeline,
      {
        gameId: cardResult.data.gameId,
        name: cardResult.data.name,
        releaseYear: cardResult.data.releaseYear,
      },
      challengerInsertPosition,
    );

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({
        score: challengerResult.data.score + 1,
        timeline: updatedTimeline as unknown as Json,
      })
      .eq("game_session_id", sid)
      .eq("user_id", challengerResult.data.userId);

    if (updatePlayerError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to award the successful challenge card."));
    }

    challengeResult = "challenger_wins";
    if (isProVariant || isExpertVariant) {
      platformBonusPlayerId = challengerResult.data.userId;
    }
  }

  const platformBonusEligible =
    platformBonusPlayerId !== undefined &&
    !isExpertVariant &&
    !isStandardVariant &&
    (isProVariant || isCorrect);
  const expertVerificationEligible = platformBonusPlayerId !== undefined && isExpertVariant;
  if (platformBonusEligible) {
    const platformBonusStateResult = await loadPlatformBonusState(
      serviceClient,
      cardResult.data.gameId,
      cardResult.data.releaseYear,
    );
    if (!platformBonusStateResult.success) {
      return platformBonusStateResult;
    }

    const platformBonusDeadline = buildPlatformBonusDeadline();
    const platformBonusTurn: TurnState = {
      ...session.currentTurn,
      ...(challengerId !== undefined ? { challengeResult, challengerId } : {}),
      isCorrect,
      phase: "platform_bonus",
      phaseDeadline: platformBonusDeadline,
      ...(platformBonusPlayerId === undefined ? {} : { platformBonusPlayerId }),
      platformOptions: [...platformBonusStateResult.data.options],
    };
    const { error: updateTurnError } = await serviceClient
      .from("game_sessions")
      .update({
        current_turn: platformBonusTurn as unknown as Json,
      })
      .eq("id", sid)
      .eq("turn_number", session.turnNumber)
      .eq("current_turn->>phase", "revealing");

    if (updateTurnError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to start the multiplayer platform bonus."));
    }

    const boardResult = await loadBoardState(serviceClient, sid);
    if (!boardResult.success) {
      return boardResult;
    }

    revalidateGamePath(sid);
    return ok({
      reveal: {
        card: cardResult.data,
        ...(challengeResult !== undefined ? { challengeResult } : {}),
        ...(challengerId !== undefined ? { challengerId } : {}),
        isCorrect,
        platformBonusDeadline,
        platformOptions: platformBonusStateResult.data.options,
        ...(platformBonusPlayerId === undefined ? {} : { platformBonusPlayerId }),
        position: session.currentTurn.placedPosition,
        scores: boardResult.data.scores,
        timelines: boardResult.data.timelines,
        tokens: boardResult.data.tokens,
      },
    });
  }

  if (expertVerificationEligible) {
    const platformBonusStateResult = await loadPlatformBonusState(
      serviceClient,
      cardResult.data.gameId,
      cardResult.data.releaseYear,
    );
    if (!platformBonusStateResult.success) {
      return platformBonusStateResult;
    }

    const expertVerificationDeadline = buildExpertVerificationDeadline();
    const expertVerificationTurn: TurnState = {
      ...session.currentTurn,
      ...(challengerId !== undefined ? { challengeResult, challengerId } : {}),
      isCorrect,
      phase: "expert_verification",
      phaseDeadline: expertVerificationDeadline,
      ...(platformBonusPlayerId === undefined ? {} : { platformBonusPlayerId }),
      platformOptions: [...platformBonusStateResult.data.options],
    };
    const { error: updateTurnError } = await serviceClient
      .from("game_sessions")
      .update({
        current_turn: expertVerificationTurn as unknown as Json,
      })
      .eq("id", sid)
      .eq("turn_number", session.turnNumber)
      .eq("current_turn->>phase", "revealing");

    if (updateTurnError !== null) {
      return fail(
        appError("INTERNAL_ERROR", "Failed to start the multiplayer expert verification."),
      );
    }

    const boardResult = await loadBoardState(serviceClient, sid);
    if (!boardResult.success) {
      return boardResult;
    }

    revalidateGamePath(sid);
    return ok({
      reveal: {
        card: cardResult.data,
        ...(challengeResult !== undefined ? { challengeResult } : {}),
        ...(challengerId !== undefined ? { challengerId } : {}),
        expertVerificationDeadline,
        isCorrect,
        platformOptions: platformBonusStateResult.data.options,
        ...(platformBonusPlayerId === undefined ? {} : { platformBonusPlayerId }),
        position: session.currentTurn.placedPosition,
        scores: boardResult.data.scores,
        timelines: boardResult.data.timelines,
        tokens: boardResult.data.tokens,
      },
    });
  }

  const resolvedTurn = buildCompletedTurn(session.currentTurn, {
    ...(challengerId !== undefined ? { challengeResult, challengerId } : {}),
    isCorrect,
  });
  const { error: updateTurnError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: resolvedTurn as unknown as Json,
    })
    .eq("id", sid)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "revealing");

  if (updateTurnError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to store the multiplayer reveal result."));
  }

  const boardResult = await loadBoardState(serviceClient, sid);
  if (!boardResult.success) {
    return boardResult;
  }

  const followUpResult = await buildFollowUpAfterReveal(
    serviceClient,
    sid,
    session,
    boardResult.data.players,
  );
  if (!followUpResult.success) {
    return followUpResult;
  }

  revalidateGamePath(sid);
  return ok({
    followUp: followUpResult.data,
    reveal: {
      card: cardResult.data,
      ...(challengeResult !== undefined ? { challengeResult } : {}),
      ...(challengerId !== undefined ? { challengerId } : {}),
      isCorrect,
      position: session.currentTurn.placedPosition,
      scores: boardResult.data.scores,
      timelines: boardResult.data.timelines,
      tokens: boardResult.data.tokens,
    },
  });
}

/**
 * Skip an expired placing phase and advance to the next multiplayer turn.
 */
export async function skipTurn(
  sessionId: string,
  options: Readonly<{
    presenceUserIds?: readonly string[];
    reason?: "disconnect_timeout" | "turn_timer_expired";
  }> = {},
): Promise<Result<SkipTurnResult, AppError>> {
  const parsed = SkipTurnSchema.safeParse({
    presenceUserIds: [...(options.presenceUserIds ?? [])],
    reason: options.reason ?? "turn_timer_expired",
    sessionId,
  });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }
  const sid = parsed.data.sessionId;

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }
  const membershipResult = await ensureSessionMember(supabase, sid, userIdResult.data);
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, sid);
  if (!sessionResult.success) {
    return sessionResult;
  }
  const session = sessionResult.data;

  if (session.currentTurn.phase !== "placing") {
    return fail(appError("CONFLICT", "This multiplayer turn cannot be skipped right now."));
  }

  if (parsed.data.reason === "disconnect_timeout") {
    if (parsed.data.presenceUserIds.includes(session.activePlayerId)) {
      return fail(
        appError(
          "CONFLICT",
          "The active player reconnected before the disconnect grace period expired.",
        ),
      );
    }
  } else if (
    session.currentTurn.phaseDeadline === undefined ||
    new Date(session.currentTurn.phaseDeadline).getTime() > Date.now()
  ) {
    return fail(appError("CONFLICT", "That multiplayer turn has not expired yet."));
  }

  const followUpResult = await buildFollowUpAfterSkip(serviceClient, sid, session);
  if (!followUpResult.success) {
    return followUpResult;
  }

  revalidateGamePath(sid);
  return ok({
    followUp: followUpResult.data,
    skipped: {
      playerId: session.activePlayerId,
      reason: parsed.data.reason,
    },
  });
}
