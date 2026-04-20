// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import type { TimelineEntry } from "./deck";
import {
  buildCompletedTurn,
  revalidateGamePath,
  restoreGamePlayerState,
  type ServiceClient,
  type WritableGameSession,
} from "./gameActionTypes";
import {
  loadBoardState,
  loadWritableGamePlayer,
  loadWritableGameSession,
} from "./gameDataLoaders";
import { buildFollowUpAfterReveal, buildFollowUpAfterSkip } from "./turnLifecycle";
import { resolveTurnInternal } from "./turnResolution";

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/** Seconds past the phaseDeadline before the server considers a phase expired. */
export const PHASE_EXPIRY_GRACE_PERIOD_SECONDS = 15;

/** Nominal scan interval in seconds. Vercel cron minimum is 60 s. */
export const PHASE_EXPIRY_SCAN_INTERVAL_SECONDS = 60;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ExpiredSessionRow {
  id: string;
  phase: string;
  phaseDeadline: string;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Return all active sessions with a phaseDeadline older than the grace period. */
async function queryExpiredSessions(
  serviceClient: ServiceClient,
): Promise<Result<ExpiredSessionRow[], AppError>> {
  const { data, error } = await serviceClient
    .from("game_sessions")
    .select("id, current_turn")
    .eq("status", "active")
    .not("current_turn->phaseDeadline", "is", null);

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to query active game sessions."));
  }

  const now = Date.now();
  const gracePeriodMs = PHASE_EXPIRY_GRACE_PERIOD_SECONDS * 1000;
  const expired: ExpiredSessionRow[] = [];

  for (const row of data) {
    const ct = row.current_turn as Record<string, unknown> | null;
    if (ct === null || typeof ct !== "object") continue;
    const deadline = ct["phaseDeadline"];
    const phase = ct["phase"];
    if (typeof deadline !== "string" || typeof phase !== "string") continue;
    if (
      phase === "placing" ||
      phase === "challenge_window" ||
      phase === "platform_bonus" ||
      phase === "expert_verification"
    ) {
      const deadlineMs = new Date(deadline).getTime();
      if (deadlineMs + gracePeriodMs < now) {
        expired.push({ id: row.id, phase, phaseDeadline: deadline });
      }
    }
  }

  return ok(expired);
}

// ---------------------------------------------------------------------------
// Phase transition helpers
// ---------------------------------------------------------------------------

/**
 * Advance an expired placing phase by skipping the turn and starting the next one.
 */
async function advancePlacingPhase(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
): Promise<Result<true, AppError>> {
  const followUpResult = await buildFollowUpAfterSkip(serviceClient, sessionId, session);
  if (!followUpResult.success) {
    return followUpResult;
  }
  revalidateGamePath(sessionId);
  return ok(true);
}

/**
 * Advance an expired challenge window: transition to revealing and resolve the turn.
 */
async function advanceChallengeWindow(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
): Promise<Result<true, AppError>> {
  if (session.currentTurn.challengerId !== undefined) {
    return fail(appError("CONFLICT", "A challenge was already submitted."));
  }

  const updatedTurn = { ...session.currentTurn, phase: "revealing" as const };
  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({ current_turn: updatedTurn as unknown as Json })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "challenge_window")
    .is("current_turn->challengerId", null)
    .select("id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to advance from expired challenge window."));
  }
  if (updatedSession === null) {
    return fail(appError("CONFLICT", "Session was already advanced by a client."));
  }

  const revealResult = await resolveTurnInternal(serviceClient, sessionId);
  if (!revealResult.success) {
    return revealResult;
  }
  return ok(true);
}

/**
 * Advance an expired platform bonus phase: resolve as incorrect (no token award).
 * For the PRO variant an incorrect answer removes the card from the player's timeline.
 */
async function advancePlatformBonus(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
): Promise<Result<true, AppError>> {
  const isProVariant = session.settings.variant === "pro";
  const platformBonusPlayerId =
    session.currentTurn.platformBonusPlayerId ?? session.activePlayerId;
  let rollbackState: Readonly<{
    fields: Readonly<{ score?: number; timeline?: readonly TimelineEntry[] }>;
    userId: string;
  }> | null = null;

  if (isProVariant) {
    const playerResult = await loadWritableGamePlayer(
      serviceClient,
      sessionId,
      platformBonusPlayerId,
    );
    if (!playerResult.success) {
      return playerResult;
    }

    const updatedTimeline = playerResult.data.timeline.filter(
      (entry) => entry.gameId !== session.currentTurn.gameId,
    );
    const updatedScore = Math.max(0, playerResult.data.score - 1);
    rollbackState = {
      fields: { score: playerResult.data.score, timeline: playerResult.data.timeline },
      userId: playerResult.data.userId,
    };

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({ score: updatedScore, timeline: updatedTimeline as unknown as Json })
      .eq("game_session_id", sessionId)
      .eq("user_id", platformBonusPlayerId);

    if (updatePlayerError !== null) {
      return fail(
        appError("INTERNAL_ERROR", "Failed to apply the PRO platform bonus timeout penalty."),
      );
    }
  }

  const completedTurn = buildCompletedTurn(session.currentTurn, { platformBonusCorrect: false });
  const { data: updatedSession, error: updateTurnError } = await serviceClient
    .from("game_sessions")
    .update({ current_turn: completedTurn as unknown as Json })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "platform_bonus")
    .select("id")
    .maybeSingle();

  if (updateTurnError !== null || updatedSession === null) {
    if (rollbackState !== null) {
      await restoreGamePlayerState(
        serviceClient,
        sessionId,
        rollbackState.userId,
        rollbackState.fields,
      );
    }
    if (updateTurnError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to complete the expired platform bonus."));
    }
    return fail(appError("CONFLICT", "Session was already advanced by a client."));
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

  revalidateGamePath(sessionId);
  return ok(true);
}

/**
 * Advance an expired expert verification phase: resolve as all-incorrect (penalty applies).
 * The expert player loses the card from their timeline and loses one score point.
 */
async function advanceExpertVerification(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
): Promise<Result<true, AppError>> {
  const expertPlayerId = session.currentTurn.platformBonusPlayerId ?? session.activePlayerId;

  const playerResult = await loadWritableGamePlayer(serviceClient, sessionId, expertPlayerId);
  if (!playerResult.success) {
    return playerResult;
  }

  const updatedTimeline = playerResult.data.timeline.filter(
    (entry) => entry.gameId !== session.currentTurn.gameId,
  );
  const updatedScore = Math.max(0, playerResult.data.score - 1);
  const rollbackState = {
    fields: { score: playerResult.data.score, timeline: playerResult.data.timeline },
    userId: playerResult.data.userId,
  };

  const { error: updatePlayerError } = await serviceClient
    .from("game_players")
    .update({ score: updatedScore, timeline: updatedTimeline as unknown as Json })
    .eq("game_session_id", sessionId)
    .eq("user_id", expertPlayerId);

  if (updatePlayerError !== null) {
    return fail(
      appError("INTERNAL_ERROR", "Failed to apply the expert verification timeout penalty."),
    );
  }

  const completedTurn = buildCompletedTurn(session.currentTurn);
  const { data: updatedSession, error: updateTurnError } = await serviceClient
    .from("game_sessions")
    .update({ current_turn: completedTurn as unknown as Json })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "expert_verification")
    .select("id")
    .maybeSingle();

  if (updateTurnError !== null || updatedSession === null) {
    await restoreGamePlayerState(
      serviceClient,
      sessionId,
      rollbackState.userId,
      rollbackState.fields,
    );
    if (updateTurnError !== null) {
      return fail(
        appError("INTERNAL_ERROR", "Failed to complete the expired expert verification."),
      );
    }
    return fail(appError("CONFLICT", "Session was already advanced by a client."));
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

  revalidateGamePath(sessionId);
  return ok(true);
}

/** Dispatch to the correct phase transition for an expired session. */
async function advanceExpiredSession(
  serviceClient: ServiceClient,
  sessionId: string,
  expectedPhase: string,
): Promise<Result<true, AppError>> {
  const sessionResult = await loadWritableGameSession(serviceClient, sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }
  const session = sessionResult.data;

  // Guard: verify phase hasn't changed since the initial scan
  if (session.currentTurn.phase !== expectedPhase) {
    return fail(
      appError(
        "CONFLICT",
        `Phase changed from ${expectedPhase} to ${session.currentTurn.phase} before processing.`,
      ),
    );
  }

  switch (expectedPhase) {
    case "placing":
      return advancePlacingPhase(serviceClient, sessionId, session);
    case "challenge_window":
      return advanceChallengeWindow(serviceClient, sessionId, session);
    case "platform_bonus":
      return advancePlatformBonus(serviceClient, sessionId, session);
    case "expert_verification":
      return advanceExpertVerification(serviceClient, sessionId, session);
    default:
      return fail(
        appError("CONFLICT", `Phase ${expectedPhase} does not require server-side expiry.`),
      );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Summary returned by {@link scanAndAdvanceExpiredSessions}. */
export interface PhaseExpiryScanResult {
  /** Number of sessions that were successfully advanced. */
  advanced: number;
  /** Number of sessions that failed with a non-CONFLICT error. */
  errors: number;
  /** Total expired sessions found in the scan. */
  processed: number;
}

/**
 * Scan for active game sessions with expired phase deadlines and advance them.
 *
 * Intended to be called from a scheduled Vercel Cron route every
 * {@link PHASE_EXPIRY_SCAN_INTERVAL_SECONDS} seconds. Uses the service role key
 * so it operates without user context.
 *
 * Each session is processed independently — a failure on one session does not
 * prevent others from being advanced.
 */
export async function scanAndAdvanceExpiredSessions(): Promise<PhaseExpiryScanResult> {
  const serviceClient = createServiceClient();

  const expiredResult = await queryExpiredSessions(serviceClient);
  if (!expiredResult.success) {
    console.error("[phase-expiry] Failed to query expired sessions:", expiredResult.error.message);
    return { advanced: 0, errors: 1, processed: 0 };
  }

  const sessions = expiredResult.data;
  let advanced = 0;
  let errors = 0;

  for (const session of sessions) {
    const elapsedSec = Math.round(
      (Date.now() - new Date(session.phaseDeadline).getTime()) / 1000,
    );
    console.log(
      `[phase-expiry] Processing session=${session.id} phase=${session.phase} elapsed=${String(elapsedSec)}s past deadline`,
    );

    const result = await advanceExpiredSession(serviceClient, session.id, session.phase);
    if (result.success) {
      console.log(`[phase-expiry] Advanced session=${session.id}`);
      advanced++;
    } else if (result.error.code === "CONFLICT") {
      // CONFLICT means a client already advanced the phase — not an error
      console.log(
        `[phase-expiry] Session=${session.id} already advanced: ${result.error.message}`,
      );
    } else {
      console.error(
        `[phase-expiry] Error on session=${session.id}: ${result.error.message}`,
      );
      errors++;
    }
  }

  return { advanced, errors, processed: sessions.length };
}
