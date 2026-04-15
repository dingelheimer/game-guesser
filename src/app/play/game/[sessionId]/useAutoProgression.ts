// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, type RefObject } from "react";
import type { TurnSkippedReason } from "@/lib/multiplayer/turns";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";

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
}
