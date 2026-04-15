// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo } from "react";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import type {
  ExpertVerificationResultPayload,
  GameOverPayload,
  PlatformBonusResultPayload,
  TeamGameOverPayload,
} from "@/lib/multiplayer/turns";
import { reconcilePlayers } from "./gameScreenState";
import type { TransitionSetters } from "./gameScreenTypes";
import type { useGameStateTransitions } from "./useGameStateTransitions";

type CoreTransitions = ReturnType<typeof useGameStateTransitions>;

/** Hook providing bonus and endgame state transition callbacks. */
export function useGameBonusTransitions(
  game: MultiplayerGamePageData,
  setters: TransitionSetters,
  core: Pick<CoreTransitions, "resetTransient">,
) {
  const { resetTransient } = core;
  const {
    setExpertVerificationResult,
    setGame,
    setIsSkippingTurn,
    setIsSubmittingPlacement,
    setIsSubmittingTeamVote,
    setPlatformBonusResult,
    setSharePlatformBonusEarned,
    setTeamGameOver,
    setWinner,
  } = setters;

  return useMemo(() => {
    const applyPlatformBonusResult = (payload: PlatformBonusResultPayload) => {
      resetTransient();
      setPlatformBonusResult(payload);
      if (game.currentTurn.platformBonusPlayerId === game.currentUserId && payload.correct) {
        setSharePlatformBonusEarned((prev) => prev + 1);
      }
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          platformBonusPlayerId: null,
        },
        players: reconcilePlayers(
          cur.players,
          payload.timelines,
          payload.scores,
          payload.tokens,
          null,
        ),
      }));
    };

    const applyExpertVerificationResult = (payload: ExpertVerificationResultPayload) => {
      resetTransient();
      setExpertVerificationResult(payload);
      if (game.currentTurn.platformBonusPlayerId === game.currentUserId && payload.correct) {
        setSharePlatformBonusEarned((prev) => prev + 1);
      }
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          platformBonusPlayerId: null,
        },
        players: reconcilePlayers(
          cur.players,
          payload.timelines,
          payload.scores,
          payload.tokens,
          null,
        ),
      }));
    };

    const applyGameOver = (payload: GameOverPayload) => {
      resetTransient();
      setIsSkippingTurn(false);
      setIsSubmittingPlacement(false);
      setWinner({
        displayName: payload.displayName,
        userId: payload.winnerId,
      });
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          platformOptions: [],
          platformBonusPlayerId: null,
        },
        players: reconcilePlayers(
          cur.players,
          payload.finalTimelines,
          payload.finalScores,
          Object.fromEntries(cur.players.map((p) => [p.userId, p.tokens])),
          null,
        ),
        status: "finished",
      }));
    };

    const applyTeamVoteUpdated = (votes: Record<string, { position: number; locked: boolean }>) => {
      setGame((cur) => ({
        ...cur,
        currentTurn: { ...cur.currentTurn, votes },
      }));
    };

    const applyTeamVoteResolved = (payload: {
      correct: boolean;
      teamScore: number;
      teamTimeline: readonly {
        gameId: number;
        name: string;
        releaseYear: number;
      }[];
      teamTokens: number;
    }) => {
      resetTransient();
      setIsSubmittingTeamVote(false);
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          votes: {},
        },
        teamScore: payload.teamScore,
        teamTimeline: payload.teamTimeline.map((e) => ({
          coverImageId: null,
          gameId: e.gameId,
          isRevealed: true,
          platform: "",
          releaseYear: e.releaseYear,
          screenshotImageId: null,
          title: e.name,
        })),
        teamTokens: payload.teamTokens,
      }));
    };

    const applyTeamGameOver = (payload: TeamGameOverPayload) => {
      resetTransient();
      setIsSubmittingTeamVote(false);
      setIsSkippingTurn(false);
      setIsSubmittingPlacement(false);
      setTeamGameOver(payload);
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          votes: {},
        },
        status: "finished",
      }));
    };

    return {
      applyExpertVerificationResult,
      applyGameOver,
      applyPlatformBonusResult,
      applyTeamGameOver,
      applyTeamVoteResolved,
      applyTeamVoteUpdated,
    } as const;
  }, [game.currentTurn.platformBonusPlayerId, game.currentUserId, resetTransient]);
}
