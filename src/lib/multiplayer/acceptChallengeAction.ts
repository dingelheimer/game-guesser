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
  SessionIdSchema,
  type AcceptChallengeResult,
} from "./gameActionTypes";
import { loadWritableGameSession } from "./gameDataLoaders";
import { resolveTurn } from "./turnActions";

/**
 * Record the calling player's decision to accept the current placement without
 * challenging. If all non-active connected players have accepted, immediately
 * proceeds to reveal (same path as proceedFromChallenge).
 *
 * @param sessionId - The game session to accept in.
 * @param presenceUserIds - User IDs of currently connected players (from presence).
 */
export async function acceptChallenge(
  sessionId: string,
  presenceUserIds: string[],
): Promise<Result<AcceptChallengeResult, AppError>> {
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
    return fail(appError("CONFLICT", "This multiplayer turn is not in the challenge window."));
  }

  if (sessionResult.data.activePlayerId === userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "The active player cannot accept their own placement."));
  }

  if (sessionResult.data.currentTurn.challengerId !== undefined) {
    return fail(appError("CONFLICT", "A player already challenged this placement."));
  }

  const existingAccepted = sessionResult.data.currentTurn.acceptedPlayerIds ?? [];
  if (existingAccepted.includes(userIdResult.data)) {
    // Already accepted — idempotent: compute allAccepted status and return
    const connectedNonActive = presenceUserIds.filter(
      (id) => id !== sessionResult.data.activePlayerId,
    );
    const allAccepted =
      connectedNonActive.length > 0 &&
      connectedNonActive.every((id) => existingAccepted.includes(id));
    return ok({ allAccepted });
  }

  const updatedAccepted = [...existingAccepted, userIdResult.data];
  const connectedNonActive = presenceUserIds.filter(
    (id) => id !== sessionResult.data.activePlayerId,
  );
  const allAccepted =
    connectedNonActive.length > 0 && connectedNonActive.every((id) => updatedAccepted.includes(id));

  if (allAccepted) {
    // All connected non-active players accepted — proceed to reveal atomically
    const updatedTurn: TurnState = {
      ...sessionResult.data.currentTurn,
      acceptedPlayerIds: updatedAccepted,
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
      return fail(appError("INTERNAL_ERROR", "Failed to advance the challenge window."));
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
      allAccepted: true,
      ...(revealResult.data.followUp === undefined ? {} : { followUp: revealResult.data.followUp }),
      reveal: revealResult.data.reveal,
    });
  }

  // Not all accepted yet — record this player's accept atomically
  const partialTurn: TurnState = {
    ...sessionResult.data.currentTurn,
    acceptedPlayerIds: updatedAccepted,
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: partialTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("current_turn->>phase", "challenge_window")
    .is("current_turn->challengerId", null)
    .select("id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to record your acceptance."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "Another player already advanced this multiplayer turn."));
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({ allAccepted: false });
}
