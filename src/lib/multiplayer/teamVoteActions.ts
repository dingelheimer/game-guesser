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
  SubmitTeamVoteSchema,
  type ServiceClient,
  type SubmitTeamVoteResult,
  type TurnFollowUpResult,
  type WritableGameSession,
} from "./gameActionTypes";
import { loadResolvedTurnCard, loadWritableGameSession } from "./gameDataLoaders";
import { buildFollowUpAfterTeamVote } from "./turnLifecycle";
import { insertTimelineEntry, isPlacementCorrect, type TeamVoteResolvedPayload } from "./turns";

/** Tally votes and resolve the team placement, updating score/timeline/tokens. */
async function resolveTeamVote(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  votes: Readonly<Record<string, Readonly<{ position: number; locked: boolean }>>>,
): Promise<
  Result<{ resolvedPayload: TeamVoteResolvedPayload; followUp: TurnFollowUpResult }, AppError>
> {
  const teamTimeline = session.teamTimeline;
  const currentTokens = session.teamTokens;
  const currentScore = session.teamScore;

  if (teamTimeline === null || currentTokens === null || currentScore === null) {
    return fail(appError("INTERNAL_ERROR", "Missing team state for TEAMWORK resolution."));
  }

  const cardResult = await loadResolvedTurnCard(serviceClient, session.currentTurn);
  if (!cardResult.success) {
    return cardResult;
  }

  // Tally votes: count votes per position.
  const voteCounts: Record<number, number> = {};
  const voterBreakdown: Record<string, number> = {};
  for (const [playerId, vote] of Object.entries(votes)) {
    const pos = vote.position;
    voteCounts[pos] = (voteCounts[pos] ?? 0) + 1;
    voterBreakdown[playerId] = pos;
  }

  // Find position with most votes; tie-break toward host (first in turn order).
  let winningPosition = 0;
  let maxVotes = -1;
  for (const player of session.turnOrder) {
    const pos = votes[player]?.position;
    if (pos === undefined) {
      continue;
    }

    const count = voteCounts[pos] ?? 0;
    if (count > maxVotes) {
      maxVotes = count;
      winningPosition = pos;
    }
  }

  const isCorrect = isPlacementCorrect(teamTimeline, cardResult.data.releaseYear, winningPosition);

  let updatedTeamTimeline = teamTimeline;
  let updatedTeamScore = currentScore;
  let updatedTeamTokens = currentTokens;

  if (isCorrect) {
    updatedTeamTimeline = insertTimelineEntry(
      teamTimeline,
      {
        gameId: cardResult.data.gameId,
        name: cardResult.data.name,
        releaseYear: cardResult.data.releaseYear,
      },
      winningPosition,
    );
    updatedTeamScore = currentScore + 1;
  } else {
    updatedTeamTokens = currentTokens - 1;
  }

  const completedTurn = buildCompletedTurn(session.currentTurn, { isCorrect });
  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: completedTurn as unknown as Json,
      team_score: updatedTeamScore,
      team_timeline: updatedTeamTimeline as unknown as Json,
      team_tokens: updatedTeamTokens,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "team_voting")
    .select("id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to resolve the team vote."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This team vote has already been resolved."));
  }

  const resolvedPayload: TeamVoteResolvedPayload = {
    card: cardResult.data,
    correct: isCorrect,
    position: winningPosition,
    teamScore: updatedTeamScore,
    teamTimeline: updatedTeamTimeline,
    teamTokens: updatedTeamTokens,
    voterBreakdown,
  };

  const followUpResult = await buildFollowUpAfterTeamVote(
    serviceClient,
    sessionId,
    session,
    updatedTeamScore,
    updatedTeamTimeline,
    updatedTeamTokens,
  );
  if (!followUpResult.success) {
    return followUpResult;
  }

  return ok({ resolvedPayload, followUp: followUpResult.data });
}

/**
 * Submit or update the calling player's team vote position and, if all connected
 * players have locked in, automatically resolve the team vote.
 */
export async function submitTeamVote(
  sessionId: string,
  position: number,
  locked: boolean,
  presenceUserIds: string[],
): Promise<Result<SubmitTeamVoteResult, AppError>> {
  const parsed = SubmitTeamVoteSchema.safeParse({ sessionId, position, locked, presenceUserIds });
  if (!parsed.success) {
    return fail(
      appError("VALIDATION_ERROR", "Please provide a valid vote position before submitting."),
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

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const session = sessionResult.data;

    if (session.currentTurn.phase !== "team_voting") {
      return fail(appError("CONFLICT", "This turn is no longer accepting team votes."));
    }

    if (
      session.teamTimeline === null ||
      session.teamTokens === null ||
      session.teamScore === null
    ) {
      return fail(appError("CONFLICT", "This game session is not configured for TEAMWORK mode."));
    }

    const currentVotes = session.currentTurn.votes ?? {};
    const updatedVotes: Record<string, { position: number; locked: boolean }> = {
      ...currentVotes,
      [userIdResult.data]: { position: parsed.data.position, locked: parsed.data.locked },
    };

    // Check if all connected players have locked in.
    const connectedPlayers = parsed.data.presenceUserIds.filter((id) =>
      session.turnOrder.includes(id),
    );
    const allLocked =
      connectedPlayers.length > 0 &&
      connectedPlayers.every((id) => updatedVotes[id]?.locked === true);

    if (allLocked) {
      // Try to resolve the vote; the DB update in resolveTeamVote uses an optimistic lock.
      const updatedTurn: TurnState = { ...session.currentTurn, votes: updatedVotes };
      const { error: voteUpdateError } = await serviceClient
        .from("game_sessions")
        .update({ current_turn: updatedTurn as unknown as Json })
        .eq("id", parsed.data.sessionId)
        .eq("turn_number", session.turnNumber)
        .eq("current_turn->>phase", "team_voting");

      if (voteUpdateError !== null && attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, 50 * (attempt + 1));
        });
        continue;
      }

      const resolveResult = await resolveTeamVote(
        serviceClient,
        parsed.data.sessionId,
        { ...session, currentTurn: updatedTurn },
        updatedVotes,
      );
      if (!resolveResult.success) {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((resolve) => {
            setTimeout(resolve, 50 * (attempt + 1));
          });
          continue;
        }

        return resolveResult;
      }

      revalidateGamePath(parsed.data.sessionId);
      return ok({
        type: "vote_resolved",
        followUp: resolveResult.data.followUp,
        resolvedPayload: resolveResult.data.resolvedPayload,
      });
    }

    // Not all locked — just persist the vote update.
    const updatedTurn: TurnState = { ...session.currentTurn, votes: updatedVotes };
    const { data: updatedSession, error: updateError } = await serviceClient
      .from("game_sessions")
      .update({ current_turn: updatedTurn as unknown as Json })
      .eq("id", parsed.data.sessionId)
      .eq("turn_number", session.turnNumber)
      .eq("current_turn->>phase", "team_voting")
      .select("id")
      .maybeSingle();

    if (updateError !== null) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, 50 * (attempt + 1));
        });
        continue;
      }

      return fail(appError("INTERNAL_ERROR", "Failed to record your team vote."));
    }

    if (updatedSession === null) {
      return fail(appError("CONFLICT", "This turn is no longer accepting team votes."));
    }

    revalidateGamePath(parsed.data.sessionId);
    return ok({
      type: "vote_updated",
      votePayload: { votes: updatedVotes },
    });
  }

  return fail(
    appError("INTERNAL_ERROR", "Failed to record your team vote after multiple retries."),
  );
}
