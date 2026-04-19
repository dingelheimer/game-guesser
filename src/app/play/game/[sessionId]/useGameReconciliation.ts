// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import {
  fetchReconciliationState,
  type ReconciliationPayload,
} from "@/lib/multiplayer/reconciliationAction";
import { buildHiddenTurnCard, reconcilePlayers } from "./gameScreenState";
import { RECONCILIATION_POLL_INTERVAL_MS } from "./gameScreenTypes";

/** Params for the game reconciliation hook. */
type UseGameReconciliationParams = Readonly<{
  game: MultiplayerGamePageData;
  isSubmittingPlacement: boolean;
  setGame: Dispatch<SetStateAction<MultiplayerGamePageData>>;
}>;

/**
 * Merges a {@link ReconciliationPayload} from the DB into the current client game state.
 *
 * Returns the updated game state with players, scores, tokens, timelines, and turn
 * information reconciled from the server-authoritative snapshot.
 */
export function mergeReconciliationPayload(
  prev: MultiplayerGamePageData,
  serverState: ReconciliationPayload,
): MultiplayerGamePageData {
  const scores: Record<string, number> = {};
  const timelines: Record<
    string,
    ReadonlyArray<Readonly<{ gameId: number; name: string; releaseYear: number }>>
  > = {};
  const tokens: Record<string, number> = {};
  for (const p of serverState.players) {
    scores[p.userId] = p.score;
    timelines[p.userId] = p.timeline;
    tokens[p.userId] = p.tokens;
  }

  const turnAdvanced = serverState.turnNumber > prev.turnNumber;
  const newCard = turnAdvanced
    ? buildHiddenTurnCard(serverState.currentTurn.screenshotImageId, serverState.currentTurn.gameId)
    : prev.currentTurn.card;

  return {
    ...prev,
    status: serverState.status,
    turnNumber: serverState.turnNumber,
    currentTurn: {
      ...prev.currentTurn,
      activePlayerId: serverState.currentTurn.activePlayerId,
      card: newCard,
      phase: serverState.currentTurn.phase,
      phaseDeadline: serverState.currentTurn.phaseDeadline,
      platformOptions: serverState.currentTurn.platformOptions,
      ...(serverState.currentTurn.platformBonusPlayerId !== undefined
        ? { platformBonusPlayerId: serverState.currentTurn.platformBonusPlayerId }
        : {}),
      ...(serverState.currentTurn.votes !== undefined
        ? { votes: serverState.currentTurn.votes }
        : {}),
    },
    players: reconcilePlayers(prev.players, timelines, scores, tokens, null),
  };
}

/**
 * Polls the DB every {@link RECONCILIATION_POLL_INTERVAL_MS} seconds and reconciles
 * local game state when a missed broadcast has left the client behind.
 *
 * Reconciliation fires when:
 * - The server's `turnNumber` is greater than the local value, OR
 * - The server's `phase` differs from the local phase (for the same turn)
 *
 * The poll is paused when the game is finished or the player is mid-placement
 * to avoid overwriting optimistic updates.
 */
export function useGameReconciliation({
  game,
  isSubmittingPlacement,
  setGame,
}: UseGameReconciliationParams): void {
  const { sessionId, status, turnNumber } = game;
  const phase = game.currentTurn.phase;

  useEffect(() => {
    if (status === "finished" || isSubmittingPlacement) return;

    const interval = setInterval(() => {
      void (async () => {
        const serverState = await fetchReconciliationState(sessionId);
        if (serverState === null) return;

        const turnAdvanced = serverState.turnNumber > turnNumber;
        const phaseChanged =
          serverState.turnNumber === turnNumber && serverState.currentTurn.phase !== phase;

        if (!turnAdvanced && !phaseChanged) return;

        setGame((prev) => mergeReconciliationPayload(prev, serverState));
      })();
    }, RECONCILIATION_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [sessionId, status, isSubmittingPlacement, turnNumber, phase, setGame]);
}
