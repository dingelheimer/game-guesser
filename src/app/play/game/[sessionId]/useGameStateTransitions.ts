// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo } from "react";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import type { TurnRevealedPayload } from "@/lib/multiplayer/turns";
import { classifyPlacementOutcome, extendShareYearRange } from "@/lib/share";
import {
  buildHiddenTurnCard,
  previewFailedReveal,
  previewPlacement,
  reconcilePlayers,
} from "./gameScreenState";
import { FAILED_PLACEMENT_PREVIEW_MS } from "./gameScreenTypes";
import type { TransitionRefs, TransitionSetters } from "./gameScreenTypes";

/** Hook providing core game state transition callbacks (turn lifecycle). */
export function useGameStateTransitions(
  game: MultiplayerGamePageData,
  refs: TransitionRefs,
  setters: TransitionSetters,
) {
  const {
    disconnectCountdownIntervalRef,
    failedPlacementTimeoutRef,
    playersRef,
    progressionTimeoutRef,
  } = refs;
  const {
    setActionError,
    setChallengeNotice,
    setDisconnectCountdown,
    setDisconnectGrace,
    setExpertVerificationResult,
    setGame,
    setIsSkippingTurn,
    setIsSubmittingChallenge,
    setIsSubmittingExpertVerification,
    setIsSubmittingPlacement,
    setIsSubmittingPlatformBonus,
    setPlacementFeedback,
    setPlatformBonusResult,
    setShareOutcomes,
    setSharePlatformBonusOpportunities,
    setShareYearRange,
    setWinner,
  } = setters;

  return useMemo(() => {
    const clearFailedPlacementTimeout = () => {
      if (failedPlacementTimeoutRef.current !== null) {
        window.clearTimeout(failedPlacementTimeoutRef.current);
        failedPlacementTimeoutRef.current = null;
      }
    };
    const clearProgressionTimeout = () => {
      if (progressionTimeoutRef.current !== null) {
        window.clearTimeout(progressionTimeoutRef.current);
        progressionTimeoutRef.current = null;
      }
    };
    const clearDisconnectGrace = () => {
      if (disconnectCountdownIntervalRef.current !== null) {
        window.clearInterval(disconnectCountdownIntervalRef.current);
        disconnectCountdownIntervalRef.current = null;
      }
      setDisconnectCountdown(null);
      setDisconnectGrace(null);
    };
    const resetTransient = () => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setPlacementFeedback(null);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
    };

    const applyPlacementMade = (
      activePlayerId: string,
      position: number,
      challengeDeadline?: string,
    ) => {
      resetTransient();
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          activePlayerId,
          phase: challengeDeadline !== undefined ? "challenge_window" : "revealing",
          phaseDeadline: challengeDeadline ?? null,
          platformOptions: [],
          platformBonusPlayerId: null,
        },
        players: previewPlacement(cur.players, activePlayerId, position, cur.currentTurn.card),
      }));
    };

    const trackCurrentUserPlacement = (payload: TurnRevealedPayload) => {
      if (game.currentTurn.activePlayerId === game.currentUserId) {
        const active = playersRef.current.find((p) => p.userId === game.currentTurn.activePlayerId);
        if (active !== undefined) {
          setShareOutcomes((prev) => [
            ...prev,
            classifyPlacementOutcome(
              active.timeline.map((c) => c.releaseYear),
              payload.position,
              payload.card.releaseYear,
            ),
          ]);
          setShareYearRange((prev) => extendShareYearRange(prev, payload.card.releaseYear));
        }
      }
      if (payload.platformBonusPlayerId === game.currentUserId) {
        setSharePlatformBonusOpportunities((prev) => prev + 1);
      }
    };

    const applyTurnStarted = (
      activePlayerId: string,
      deadline: string | null,
      screenshotImageId: string,
      turnNumber: number,
    ) => {
      resetTransient();
      setIsSkippingTurn(false);
      setIsSubmittingPlacement(false);
      setWinner(null);
      setGame((cur) => {
        const isTeamMulti = cur.settings.gameMode === "teamwork" && cur.players.length > 1;
        const nextPhase = isTeamMulti ? ("team_voting" as const) : ("placing" as const);
        return {
          ...cur,
          currentTurn: {
            activePlayerId,
            card: buildHiddenTurnCard(screenshotImageId),
            phase: nextPhase,
            phaseDeadline: deadline,
            platformOptions: [],
            platformBonusPlayerId: null,
            ...(isTeamMulti ? { votes: {} } : {}),
          },
          status: "active",
          turnNumber,
        };
      });
    };

    const applyTurnSkipped = () => {
      resetTransient();
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          phase: "drawing",
          phaseDeadline: null,
          platformOptions: [],
          platformBonusPlayerId: null,
        },
        players: cur.players.map((p) =>
          p.userId === cur.currentTurn.activePlayerId
            ? { ...p, timeline: p.timeline.filter((c) => c.isRevealed) }
            : p,
        ),
      }));
    };

    const applyChallengeMade = (displayName: string) => {
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(`${displayName} challenged this placement.`);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
      setGame((cur) => ({
        ...cur,
        currentTurn: {
          ...cur.currentTurn,
          phase: "revealing",
          phaseDeadline: null,
          platformOptions: [],
          platformBonusPlayerId: null,
        },
      }));
    };

    const applyTurnRevealed = (payload: TurnRevealedPayload) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      setActionError(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setIsSubmittingPlacement(false);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
      trackCurrentUserPlacement(payload);
      let activePlayerId = "";
      let challengeMessage: string | null = null;
      setGame((cur) => {
        activePlayerId = cur.currentTurn.activePlayerId;
        if (payload.challengerId !== undefined && payload.challengeResult !== undefined) {
          const challenger = cur.players.find((p) => p.userId === payload.challengerId);
          if (challenger !== undefined) {
            challengeMessage =
              payload.challengeResult === "challenger_wins"
                ? `${challenger.displayName} challenged successfully and stole the card.`
                : `${challenger.displayName} challenged and lost a token.`;
          }
        }
        const currentTurn = {
          ...cur.currentTurn,
          card: {
            coverImageId: payload.card.coverImageId ?? null,
            gameId: payload.card.gameId,
            isRevealed: true,
            platform: payload.card.platform,
            releaseYear: payload.card.releaseYear,
            screenshotImageId: payload.card.screenshotImageId,
            title: payload.card.name,
          },
          phase:
            payload.expertVerificationDeadline !== undefined
              ? ("expert_verification" as const)
              : payload.platformOptions !== undefined
                ? ("platform_bonus" as const)
                : ("revealing" as const),
          phaseDeadline:
            payload.expertVerificationDeadline ?? payload.platformBonusDeadline ?? null,
          platformBonusPlayerId: payload.platformBonusPlayerId ?? null,
          platformOptions: payload.platformOptions ?? cur.currentTurn.platformOptions,
        };
        if (!payload.isCorrect) {
          return {
            ...cur,
            currentTurn,
            players: previewFailedReveal(
              cur.players,
              cur.currentTurn.activePlayerId,
              payload.position,
              payload.card,
            ),
          };
        }
        return {
          ...cur,
          currentTurn,
          players: reconcilePlayers(
            cur.players,
            payload.timelines,
            payload.scores,
            payload.tokens,
            payload.card,
          ),
        };
      });
      if (payload.isCorrect || activePlayerId === "") {
        setPlacementFeedback(null);
        setChallengeNotice(challengeMessage);
        return;
      }
      setPlacementFeedback({
        gameId: String(payload.card.gameId),
        playerId: activePlayerId,
        tone: "error",
      });
      failedPlacementTimeoutRef.current = window.setTimeout(() => {
        setPlacementFeedback(null);
        setGame((cur) => ({
          ...cur,
          players: reconcilePlayers(
            cur.players,
            payload.timelines,
            payload.scores,
            payload.tokens,
            payload.card,
          ),
        }));
      }, FAILED_PLACEMENT_PREVIEW_MS);
      setChallengeNotice(challengeMessage);
    };

    return {
      applyChallengeMade,
      applyPlacementMade,
      applyTurnRevealed,
      applyTurnSkipped,
      applyTurnStarted,
      clearDisconnectGrace,
      clearFailedPlacementTimeout,
      clearProgressionTimeout,
      resetTransient,
    } as const;
  }, [
    disconnectCountdownIntervalRef,
    failedPlacementTimeoutRef,
    game.currentTurn.activePlayerId,
    game.currentUserId,
    playersRef,
    progressionTimeoutRef,
  ]);
}
