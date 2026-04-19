// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { RealtimeChannel } from "@supabase/realtime-js";
import {
  proceedFromChallenge,
  submitChallenge,
  submitPlacement,
} from "@/lib/multiplayer/challengeActions";
import {
  proceedFromExpertVerification,
  submitExpertVerification,
} from "@/lib/multiplayer/expertVerificationActions";
import {
  proceedFromPlatformBonus,
  submitPlatformBonus,
} from "@/lib/multiplayer/platformBonusActions";
import { submitTeamVote } from "@/lib/multiplayer/teamVoteActions";
import { skipTurn } from "@/lib/multiplayer/turnActions";
import type { TurnFollowUpResult } from "@/lib/multiplayer/gameActionTypes";
import type { LobbyPresence } from "@/lib/multiplayer/lobby";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import type { TurnSkippedReason } from "@/lib/multiplayer/turns";
import { TURN_FOLLOW_UP_DELAY_MS, type PlacementFeedback } from "./gameScreenTypes";
import type { useGameBonusTransitions } from "./useGameBonusTransitions";
import type { useGameStateTransitions } from "./useGameStateTransitions";

type CoreTransitions = ReturnType<typeof useGameStateTransitions>;
type BonusTransitions = ReturnType<typeof useGameBonusTransitions>;

type UseGameActionsParams = Readonly<{
  bonusTransitions: BonusTransitions;
  challengeRequestKeyRef: RefObject<string | null>;
  channelRef: RefObject<RealtimeChannel | null>;
  coreTransitions: CoreTransitions;
  currentPlayer: MultiplayerGamePageData["players"][number] | undefined;
  expertVerificationRequestKeyRef: RefObject<string | null>;
  game: MultiplayerGamePageData;
  platformBonusPlayerId: string;
  platformBonusRequestKeyRef: RefObject<string | null>;
  presence: LobbyPresence[];
  progressionTimeoutRef: RefObject<number | null>;
  setActionError: Dispatch<SetStateAction<string | null>>;
  setGame: Dispatch<SetStateAction<MultiplayerGamePageData>>;
  setIsSkippingTurn: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingChallenge: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingExpertVerification: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingPlacement: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingPlatformBonus: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingTeamVote: Dispatch<SetStateAction<boolean>>;
  setPlacementFeedback: Dispatch<SetStateAction<PlacementFeedback>>;
  skipRequestKeyRef: RefObject<string | null>;
}>;

/** Custom hook encapsulating all server-action handler callbacks. */
export function useGameActions({
  bonusTransitions,
  challengeRequestKeyRef,
  channelRef,
  coreTransitions,
  currentPlayer,
  expertVerificationRequestKeyRef,
  game,
  platformBonusPlayerId,
  platformBonusRequestKeyRef,
  presence,
  progressionTimeoutRef,
  setActionError,
  setGame,
  setIsSkippingTurn,
  setIsSubmittingChallenge,
  setIsSubmittingExpertVerification,
  setIsSubmittingPlacement,
  setIsSubmittingPlatformBonus,
  setIsSubmittingTeamVote,
  setPlacementFeedback,
  skipRequestKeyRef,
}: UseGameActionsParams) {
  return useMemo(() => {
    const scheduleFollowUp = (followUp: TurnFollowUpResult) => {
      coreTransitions.clearProgressionTimeout();
      progressionTimeoutRef.current = window.setTimeout(() => {
        if (followUp.type === "next_turn") {
          coreTransitions.applyTurnStarted(
            followUp.nextTurn.activePlayerId,
            followUp.nextTurn.deadline,
            followUp.nextTurn.screenshot.screenshotImageId,
            followUp.nextTurn.turnNumber,
          );
          void channelRef.current?.send({
            type: "broadcast",
            event: "turn_started",
            payload: followUp.nextTurn,
          });
          return;
        }
        if (followUp.type === "team_game_over") {
          bonusTransitions.applyTeamGameOver(followUp.gameOver);
          void channelRef.current?.send({
            type: "broadcast",
            event: "team_game_over",
            payload: followUp.gameOver,
          });
          return;
        }
        bonusTransitions.applyGameOver(followUp.gameOver);
        void channelRef.current?.send({
          type: "broadcast",
          event: "game_over",
          payload: followUp.gameOver,
        });
      }, TURN_FOLLOW_UP_DELAY_MS);
    };

    const handleSkipTurn = async (reason: TurnSkippedReason) => {
      setIsSkippingTurn(true);
      setActionError(null);
      const result = await skipTurn(game.sessionId, {
        presenceUserIds: presence.map((p) => p.userId),
        reason,
      });
      if (!result.success) {
        setIsSkippingTurn(false);
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
          skipRequestKeyRef.current = null;
        }
        return;
      }
      coreTransitions.applyTurnSkipped();
      void channelRef.current?.send({
        type: "broadcast",
        event: "turn_skipped",
        payload: result.data.skipped,
      });
      if (result.data.followUp.type === "next_turn") {
        coreTransitions.applyTurnStarted(
          result.data.followUp.nextTurn.activePlayerId,
          result.data.followUp.nextTurn.deadline,
          result.data.followUp.nextTurn.screenshot.screenshotImageId,
          result.data.followUp.nextTurn.turnNumber,
        );
        void channelRef.current?.send({
          type: "broadcast",
          event: "turn_started",
          payload: result.data.followUp.nextTurn,
        });
        return;
      }
      if (result.data.followUp.type === "team_game_over") {
        bonusTransitions.applyTeamGameOver(result.data.followUp.gameOver);
        void channelRef.current?.send({
          type: "broadcast",
          event: "team_game_over",
          payload: result.data.followUp.gameOver,
        });
        return;
      }
      bonusTransitions.applyGameOver(result.data.followUp.gameOver);
      void channelRef.current?.send({
        type: "broadcast",
        event: "game_over",
        payload: result.data.followUp.gameOver,
      });
    };

    const handleProceedFromChallenge = async () => {
      setActionError(null);
      const result = await proceedFromChallenge(game.sessionId);
      if (!result.success) {
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
          challengeRequestKeyRef.current = null;
        }
        return;
      }
      coreTransitions.applyTurnRevealed(result.data.reveal);
      void channelRef.current?.send({
        type: "broadcast",
        event: "turn_revealed",
        payload: result.data.reveal,
      });
      if (result.data.followUp !== undefined) scheduleFollowUp(result.data.followUp);
    };

    const handleChallenge = async () => {
      if (
        currentPlayer === undefined ||
        currentPlayer.userId === game.currentTurn.activePlayerId ||
        currentPlayer.tokens < 1 ||
        game.currentTurn.phase !== "challenge_window"
      )
        return;
      setIsSubmittingChallenge(true);
      setActionError(null);
      const result = await submitChallenge(game.sessionId);
      if (!result.success) {
        setIsSubmittingChallenge(false);
        if (result.error.code !== "CONFLICT") setActionError(result.error.message);
        return;
      }
      coreTransitions.applyChallengeMade(result.data.challenge.displayName);
      coreTransitions.applyTurnRevealed(result.data.reveal);
      void channelRef.current?.send({
        type: "broadcast",
        event: "turn_revealed",
        payload: {
          ...result.data.reveal,
          challengeDisplayName: result.data.challenge.displayName,
        },
      });
      if (result.data.followUp !== undefined) scheduleFollowUp(result.data.followUp);
    };

    const handleProceedFromPlatformBonus = async () => {
      setActionError(null);
      const result = await proceedFromPlatformBonus(game.sessionId);
      if (!result.success) {
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
          platformBonusRequestKeyRef.current = null;
        }
        return;
      }
      bonusTransitions.applyPlatformBonusResult(result.data.bonus);
      void channelRef.current?.send({
        type: "broadcast",
        event: "platform_bonus_result",
        payload: result.data.bonus,
      });
      scheduleFollowUp(result.data.followUp);
    };

    const handleSubmitPlatformBonus = async (selectedPlatformIds: number[]) => {
      if (
        currentPlayer === undefined ||
        currentPlayer.userId !== platformBonusPlayerId ||
        game.currentTurn.phase !== "platform_bonus"
      )
        return;
      setIsSubmittingPlatformBonus(true);
      setActionError(null);
      const result = await submitPlatformBonus(game.sessionId, selectedPlatformIds);
      if (!result.success) {
        setIsSubmittingPlatformBonus(false);
        if (result.error.code !== "CONFLICT") setActionError(result.error.message);
        return;
      }
      bonusTransitions.applyPlatformBonusResult(result.data.bonus);
      void channelRef.current?.send({
        type: "broadcast",
        event: "platform_bonus_result",
        payload: result.data.bonus,
      });
      scheduleFollowUp(result.data.followUp);
    };

    const handleProceedFromExpertVerification = async () => {
      setActionError(null);
      const result = await proceedFromExpertVerification(game.sessionId);
      if (!result.success) {
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
          expertVerificationRequestKeyRef.current = null;
        }
        return;
      }
      bonusTransitions.applyExpertVerificationResult(result.data.verification);
      void channelRef.current?.send({
        type: "broadcast",
        event: "expert_verification_result",
        payload: result.data.verification,
      });
      scheduleFollowUp(result.data.followUp);
    };

    const handleSubmitExpertVerification = async (
      yearGuess: number,
      selectedPlatformIds: number[],
    ) => {
      if (
        currentPlayer === undefined ||
        currentPlayer.userId !== platformBonusPlayerId ||
        game.currentTurn.phase !== "expert_verification"
      )
        return;
      setIsSubmittingExpertVerification(true);
      setActionError(null);
      const result = await submitExpertVerification(game.sessionId, yearGuess, selectedPlatformIds);
      if (!result.success) {
        setIsSubmittingExpertVerification(false);
        if (result.error.code !== "CONFLICT") setActionError(result.error.message);
        return;
      }
      bonusTransitions.applyExpertVerificationResult(result.data.verification);
      void channelRef.current?.send({
        type: "broadcast",
        event: "expert_verification_result",
        payload: result.data.verification,
      });
      scheduleFollowUp(result.data.followUp);
    };

    const handleTeamVote = async (position: number, locked: boolean) => {
      if (
        currentPlayer === undefined ||
        game.currentTurn.phase !== "team_voting" ||
        game.status !== "active"
      )
        return;
      setIsSubmittingTeamVote(true);
      setActionError(null);
      const result = await submitTeamVote(
        game.sessionId,
        position,
        locked,
        presence.map((p) => p.userId),
      );
      setIsSubmittingTeamVote(false);
      if (!result.success) {
        if (result.error.code !== "CONFLICT") setActionError(result.error.message);
        return;
      }
      if (result.data.type === "vote_updated") {
        bonusTransitions.applyTeamVoteUpdated(result.data.votePayload.votes);
        void channelRef.current?.send({
          type: "broadcast",
          event: "team_vote_updated",
          payload: { votes: result.data.votePayload.votes },
        });
        return;
      }
      bonusTransitions.applyTeamVoteResolved(result.data.resolvedPayload);
      void channelRef.current?.send({
        type: "broadcast",
        event: "team_vote_resolved",
        payload: result.data.resolvedPayload,
      });
      scheduleFollowUp(result.data.followUp);
    };

    const handlePlaceCard = async (position: number) => {
      if (
        game.currentTurn.phase !== "placing" ||
        game.currentTurn.activePlayerId !== game.currentUserId ||
        currentPlayer === undefined
      )
        return;
      const previousPlayers = game.players;
      const previousTurn = game.currentTurn;
      setIsSubmittingPlacement(true);
      setActionError(null);
      coreTransitions.applyPlacementMade(
        game.currentUserId,
        position,
        game.settings.tokensEnabled ? new Date(Date.now() + 10_000).toISOString() : undefined,
      );
      const result = await submitPlacement(game.sessionId, position);
      if (!result.success) {
        setIsSubmittingPlacement(false);
        setActionError(result.error.message);
        coreTransitions.clearFailedPlacementTimeout();
        setPlacementFeedback(null);
        setGame((cur) => ({ ...cur, currentTurn: previousTurn, players: previousPlayers }));
        return;
      }
      setIsSubmittingPlacement(false);
      void channelRef.current?.send({
        type: "broadcast",
        event: "placement_made",
        payload: result.data.placement,
      });
      if (result.data.type === "challenge_window") {
        coreTransitions.applyPlacementMade(
          result.data.placement.activePlayerId,
          result.data.placement.position,
          result.data.placement.challengeDeadline,
        );
        return;
      }
      coreTransitions.applyTurnRevealed(result.data.reveal);
      void channelRef.current?.send({
        type: "broadcast",
        event: "turn_revealed",
        payload: result.data.reveal,
      });
      if (result.data.followUp !== undefined) scheduleFollowUp(result.data.followUp);
    };

    return {
      handleChallenge,
      handlePlaceCard,
      handleProceedFromChallenge,
      handleProceedFromExpertVerification,
      handleProceedFromPlatformBonus,
      handleSkipTurn,
      handleSubmitExpertVerification,
      handleSubmitPlatformBonus,
      handleTeamVote,
    } as const;
  }, [bonusTransitions, coreTransitions, currentPlayer, game, platformBonusPlayerId, presence]);
}
