// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthenticatedUserId } from "./actionHelpers";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import {
  ensureSessionMember,
  revalidateGamePath,
  SessionIdSchema,
  SkipTurnSchema,
  type ResolveTurnResult,
  type SkipTurnResult,
} from "./gameActionTypes";
import { loadWritableGameSession } from "./gameDataLoaders";
import { buildFollowUpAfterSkip } from "./turnLifecycle";
import { resolveTurnInternal } from "./turnResolution";

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
  return resolveTurnInternal(serviceClient, sid);
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
