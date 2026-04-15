// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import type { LobbyPresence } from "@/lib/multiplayer/lobby";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isPlayerConnected } from "./gameScreenState";
import type { DisconnectGraceState, PlacementFeedback } from "./gameScreenTypes";
import { GamePlayerTimeline } from "./GamePlayerTimeline";

type GamePlayerTimelinesProps = Readonly<{
  disconnectCountdown: number | null;
  disconnectGrace: DisconnectGraceState;
  game: MultiplayerGamePageData;
  isSkippingTurn: boolean;
  isSubmittingPlacement: boolean;
  onPlaceCard: (position: number) => void;
  placementFeedback: PlacementFeedback;
  placingTurnKey: string | null;
  presence: LobbyPresence[];
}>;

/** Renders all player timelines with connection status, placement feedback, and disconnect indicators. */
export function GamePlayerTimelines({
  disconnectCountdown,
  disconnectGrace,
  game,
  isSkippingTurn,
  isSubmittingPlacement,
  onPlaceCard,
  placementFeedback,
  placingTurnKey,
  presence,
}: GamePlayerTimelinesProps) {
  return (
    <Card className="border-border/60 bg-surface-800/70">
      <CardHeader>
        <CardTitle>Player Timelines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {game.players.map((player) => {
          const playerIsConnected = isPlayerConnected(presence, player.userId);
          const isDisconnectedActivePlayer =
            disconnectGrace !== null &&
            disconnectGrace.turnKey === placingTurnKey &&
            player.userId === game.currentTurn.activePlayerId &&
            !playerIsConnected;
          const canPlaceCard =
            player.userId === game.currentUserId &&
            player.userId === game.currentTurn.activePlayerId &&
            game.currentTurn.phase === "placing" &&
            !isSubmittingPlacement &&
            !isSkippingTurn;

          return (
            <GamePlayerTimeline
              key={player.userId}
              highlightedCardId={
                placementFeedback?.playerId === player.userId ? placementFeedback.gameId : null
              }
              highlightedCardTone={
                placementFeedback?.playerId === player.userId ? placementFeedback.tone : null
              }
              activityBadgeLabel={
                isDisconnectedActivePlayer && disconnectCountdown !== null
                  ? `Reconnecting ${String(disconnectCountdown)}s`
                  : null
              }
              connectionLabel={
                isDisconnectedActivePlayer && disconnectCountdown !== null
                  ? `Disconnected \u2014 waiting ${String(disconnectCountdown)}s`
                  : playerIsConnected
                    ? "Connected"
                    : "Disconnected"
              }
              isActive={player.userId === game.currentTurn.activePlayerId}
              isConnected={playerIsConnected}
              isCurrentUser={player.userId === game.currentUserId}
              pendingTurnCard={canPlaceCard ? game.currentTurn.card : null}
              player={player}
              winCondition={game.settings.winCondition}
              {...(canPlaceCard
                ? {
                    onPlaceCard: (position: number) => {
                      onPlaceCard(position);
                    },
                  }
                : {})}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
