// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, type RefObject } from "react";
import type { TurnSkippedReason } from "@/lib/multiplayer/turns";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import { STALE_PHASE_POLL_INTERVAL_MS, STALE_PHASE_THRESHOLD_MS } from "./gameScreenTypes";

/** Params for the auto-progression hook. */
type UseAutoProgressionParams = Readonly<{
  challengeRequestKeyRef: RefObject<string | null>;
  expertVerificationRequestKeyRef: RefObject<string | null>;
  game: MultiplayerGamePageData;
  handleProceedFromChallenge: () => Promise<void>;
  handleProceedFromExpertVerification: () => Promise<void>;
  handleProceedFromPlatformBonus: () => Promise<void>;
  handleSkipTurn: (reason: TurnSkippedReason) => Promise<void>;
  isActivePlayerConnected: boolean;
  platformBonusRequestKeyRef: RefObject<string | null>;
  secondsRemaining: number | null;
  skipRequestKeyRef: RefObject<string | null>;
}>;

/**
 * Fires auto-skip / auto-proceed effects when phase timers expire.
 */
export function useAutoProgression({
  challengeRequestKeyRef,
  expertVerificationRequestKeyRef,
  game,
  handleProceedFromChallenge,
  handleProceedFromExpertVerification,
  handleProceedFromPlatformBonus,
  handleSkipTurn,
  isActivePlayerConnected,
  platformBonusRequestKeyRef,
  secondsRemaining,
  skipRequestKeyRef,
}: UseAutoProgressionParams): void {
  // Auto-skip on placing timer expiry
  useEffect(() => {
    if (game.currentTurn.phase !== "placing" || secondsRemaining !== 0) return;
    const reason: TurnSkippedReason = isActivePlayerConnected
      ? "turn_timer_expired"
      : "disconnect_timeout";
    const key = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:${reason}`;
    if (skipRequestKeyRef.current === key) return;
    skipRequestKeyRef.current = key;
    void handleSkipTurn(reason);
  }, [
    isActivePlayerConnected,
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleSkipTurn,
    secondsRemaining,
    skipRequestKeyRef,
  ]);

  // Auto-proceed challenge window
  useEffect(() => {
    if (game.currentTurn.phase !== "challenge_window" || secondsRemaining !== 0) return;
    const key = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:challenge`;
    if (challengeRequestKeyRef.current === key) return;
    challengeRequestKeyRef.current = key;
    void handleProceedFromChallenge();
  }, [
    challengeRequestKeyRef,
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleProceedFromChallenge,
    secondsRemaining,
  ]);

  // Auto-proceed platform bonus
  useEffect(() => {
    if (game.currentTurn.phase !== "platform_bonus" || secondsRemaining !== 0) return;
    const key = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:platform_bonus`;
    if (platformBonusRequestKeyRef.current === key) return;
    platformBonusRequestKeyRef.current = key;
    void handleProceedFromPlatformBonus();
  }, [
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleProceedFromPlatformBonus,
    platformBonusRequestKeyRef,
    secondsRemaining,
  ]);

  // Auto-proceed expert verification
  useEffect(() => {
    if (game.currentTurn.phase !== "expert_verification" || secondsRemaining !== 0) return;
    const key = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:expert_verification`;
    if (expertVerificationRequestKeyRef.current === key) return;
    expertVerificationRequestKeyRef.current = key;
    void handleProceedFromExpertVerification();
  }, [
    expertVerificationRequestKeyRef,
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleProceedFromExpertVerification,
    secondsRemaining,
  ]);

  // Stale-phase recovery: if phaseDeadline has passed by more than the threshold
  // and the phase hasn't advanced, clear the request key so auto-progression retries.
  useEffect(() => {
    const interval = setInterval(() => {
      const { phase, phaseDeadline } = game.currentTurn;
      if (phaseDeadline === null) return;
      const overdueMs = Date.now() - new Date(phaseDeadline).getTime();
      if (overdueMs <= STALE_PHASE_THRESHOLD_MS) return;
      if (phase === "placing") skipRequestKeyRef.current = null;
      else if (phase === "challenge_window") challengeRequestKeyRef.current = null;
      else if (phase === "platform_bonus") platformBonusRequestKeyRef.current = null;
      else if (phase === "expert_verification") expertVerificationRequestKeyRef.current = null;
    }, STALE_PHASE_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [
    challengeRequestKeyRef,
    expertVerificationRequestKeyRef,
    game.currentTurn,
    platformBonusRequestKeyRef,
    skipRequestKeyRef,
  ]);
}
