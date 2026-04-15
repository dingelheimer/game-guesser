// SPDX-License-Identifier: AGPL-3.0-only

import { Clock3, Signal, Trophy } from "lucide-react";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import { Card, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { formatCountdown, formatPhaseLabel } from "./gameScreenState";

type GameScreenHeaderProps = Readonly<{
  actionError: string | null;
  activePlayer: MultiplayerGamePageData["players"][number] | null;
  disconnectCountdown: number | null;
  game: MultiplayerGamePageData;
  isTeamworkMode: boolean;
  phasePlayer: MultiplayerGamePageData["players"][number] | null;
  presenceCount: number;
  secondsRemaining: number | null;
  showDisconnectNotice: boolean;
  winner: MultiplayerGamePageData["winner"];
}>;

/** Renders the status header card for the multiplayer game screen. */
export function GameScreenHeader({
  actionError,
  activePlayer,
  disconnectCountdown,
  game,
  isTeamworkMode,
  phasePlayer,
  presenceCount,
  secondsRemaining,
  showDisconnectNotice,
  winner,
}: GameScreenHeaderProps) {
  const isTeamVoting = game.currentTurn.phase === "team_voting";

  return (
    <Card className="border-border/60 bg-surface-800/70">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Trophy className="text-primary-400 h-5 w-5" />
              {isTeamworkMode ? "Co-op Game" : "Multiplayer Game"}
            </CardTitle>
            <CardDescription>
              {isTeamworkMode
                ? isTeamVoting
                  ? "Vote together on where this game belongs in the shared timeline"
                  : `Phase: ${formatPhaseLabel(game.currentTurn.phase)}`
                : activePlayer !== null
                  ? `${(phasePlayer ?? activePlayer).displayName}'s turn — ${formatPhaseLabel(game.currentTurn.phase)}`
                  : `Phase: ${formatPhaseLabel(game.currentTurn.phase)}`}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
              Turn {game.turnNumber}
            </span>
            {isTeamworkMode ? (
              <>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  Score: {game.teamScore ?? 0} / {game.settings.winCondition}
                </span>
                <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-rose-200">
                  {"❤️".repeat(Math.max(0, game.teamTokens ?? 5))} {game.teamTokens ?? 5} lives
                </span>
              </>
            ) : (
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                First to {game.settings.winCondition}
              </span>
            )}
            {secondsRemaining !== null ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                {formatCountdown(secondsRemaining)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-text-secondary flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2">
            <Signal className="h-4 w-4" />
            {presenceCount}/{game.players.length} players connected
          </span>
          <span>Room session: {game.sessionId}</span>
        </div>

        {winner !== null ? (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <strong>{winner.displayName}</strong> has won the game.
          </div>
        ) : null}

        {showDisconnectNotice && disconnectCountdown !== null && activePlayer !== null ? (
          <div
            className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            role="alert"
          >
            <strong>{activePlayer.displayName}</strong> disconnected — waiting {disconnectCountdown}
            s before skipping the turn.
          </div>
        ) : null}

        {actionError !== null ? (
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {actionError}
          </div>
        ) : null}
      </CardHeader>
    </Card>
  );
}
