// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { LobbyPresence } from "@/lib/multiplayer/lobby";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import { getCountdownSeconds, isPlayerConnected } from "./gameScreenState";
import {
  ACTIVE_PLAYER_DISCONNECT_GRACE_SECONDS,
  type DisconnectGraceState,
} from "./gameScreenTypes";

/** Params for the game timers hook. */
type UseGameTimersParams = Readonly<{
  clearDisconnectGrace: () => void;
  currentPlayer: MultiplayerGamePageData["players"][number] | undefined;
  disconnectCountdownIntervalRef: RefObject<number | null>;
  disconnectGrace: DisconnectGraceState;
  game: MultiplayerGamePageData;
  placingTurnKey: string | null;
  presence: LobbyPresence[];
  setDisconnectCountdown: (value: number | null) => void;
  setDisconnectGrace: (value: DisconnectGraceState) => void;
}>;

/**
 * Manages disconnect grace countdown, disconnect grace lifecycle, and
 * phase deadline countdown for the multiplayer game screen.
 */
export function useGameTimers({
  clearDisconnectGrace,
  currentPlayer,
  disconnectCountdownIntervalRef,
  disconnectGrace,
  game,
  placingTurnKey,
  presence,
  setDisconnectCountdown,
  setDisconnectGrace,
}: UseGameTimersParams) {
  const activePlayer = useMemo(
    () => game.players.find((p) => p.userId === game.currentTurn.activePlayerId) ?? null,
    [game.currentTurn.activePlayerId, game.players],
  );

  const isActivePlayerConnected =
    activePlayer !== null && isPlayerConnected(presence, activePlayer.userId);

  const effectivePhaseDeadline = useMemo(() => {
    if (
      game.currentTurn.phase !== "placing" ||
      disconnectGrace === null ||
      disconnectGrace.turnKey !== placingTurnKey
    ) {
      return game.currentTurn.phaseDeadline;
    }
    if (!isActivePlayerConnected) return disconnectGrace.deadline;
    if (game.currentTurn.phaseDeadline === null) return disconnectGrace.deadline;
    return new Date(game.currentTurn.phaseDeadline).getTime() >=
      new Date(disconnectGrace.deadline).getTime()
      ? game.currentTurn.phaseDeadline
      : disconnectGrace.deadline;
  }, [
    disconnectGrace,
    game.currentTurn.phase,
    game.currentTurn.phaseDeadline,
    isActivePlayerConnected,
    placingTurnKey,
  ]);

  // Disconnect countdown interval
  useEffect(() => {
    if (disconnectGrace === null) {
      if (disconnectCountdownIntervalRef.current !== null) {
        window.clearInterval(disconnectCountdownIntervalRef.current);
        disconnectCountdownIntervalRef.current = null;
      }
      setDisconnectCountdown(null);
      return;
    }
    const updateCountdown = () => {
      setDisconnectCountdown(getCountdownSeconds(disconnectGrace.deadline));
    };
    updateCountdown();
    if (disconnectCountdownIntervalRef.current !== null) {
      window.clearInterval(disconnectCountdownIntervalRef.current);
    }
    disconnectCountdownIntervalRef.current = window.setInterval(updateCountdown, 1000);
    return () => {
      if (disconnectCountdownIntervalRef.current !== null) {
        window.clearInterval(disconnectCountdownIntervalRef.current);
        disconnectCountdownIntervalRef.current = null;
      }
    };
  }, [disconnectCountdownIntervalRef, disconnectGrace, setDisconnectCountdown]);

  // Disconnect grace lifecycle
  useEffect(() => {
    if (placingTurnKey === null || currentPlayer === undefined) {
      clearDisconnectGrace();
      return;
    }
    if (disconnectGrace !== null && disconnectGrace.turnKey !== placingTurnKey) {
      clearDisconnectGrace();
      return;
    }
    if (
      disconnectGrace === null &&
      currentPlayer.userId !== game.currentTurn.activePlayerId &&
      !isActivePlayerConnected
    ) {
      setDisconnectGrace({
        deadline: new Date(
          Date.now() + ACTIVE_PLAYER_DISCONNECT_GRACE_SECONDS * 1000,
        ).toISOString(),
        turnKey: placingTurnKey,
      });
      setDisconnectCountdown(ACTIVE_PLAYER_DISCONNECT_GRACE_SECONDS);
    }
  }, [
    clearDisconnectGrace,
    currentPlayer,
    disconnectGrace,
    game.currentTurn.activePlayerId,
    isActivePlayerConnected,
    placingTurnKey,
    setDisconnectCountdown,
    setDisconnectGrace,
  ]);

  // Phase deadline countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() =>
    getCountdownSeconds(effectivePhaseDeadline),
  );

  useEffect(() => {
    setSecondsRemaining(getCountdownSeconds(effectivePhaseDeadline));
    if (effectivePhaseDeadline === null) return;
    const timerId = window.setInterval(() => {
      setSecondsRemaining(getCountdownSeconds(effectivePhaseDeadline));
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [effectivePhaseDeadline]);

  return {
    activePlayer,
    effectivePhaseDeadline,
    isActivePlayerConnected,
    secondsRemaining,
  } as const;
}
