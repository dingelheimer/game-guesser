"use client";

import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import type { MultiplayerGamePagePlayer } from "@/lib/multiplayer/gamePage";
import { sortPlayersByStanding } from "@/lib/multiplayer/rankings";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GamePlayerTimeline } from "./GamePlayerTimeline";

/**
 * Props for the multiplayer end-of-game standings screen.
 */
export type MultiplayerGameOverViewProps = Readonly<{
  connectedUserIds: readonly string[];
  currentUserId: string;
  players: readonly MultiplayerGamePagePlayer[];
  winCondition: number;
  winner: Readonly<{
    displayName: string;
    userId: string;
  }>;
}>;

/**
 * Render the final multiplayer rankings once a session finishes.
 */
export function MultiplayerGameOverView({
  connectedUserIds,
  currentUserId,
  players,
  winCondition,
  winner,
}: MultiplayerGameOverViewProps) {
  const rankedPlayers = sortPlayersByStanding(players);

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="w-full max-w-7xl space-y-6">
        <Card className="border-border/60 bg-surface-800/70">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Trophy className="text-primary-400 h-5 w-5" />
                  Final Standings
                </CardTitle>
                <CardDescription>
                  <strong>{winner.displayName}</strong> wins the multiplayer match.
                </CardDescription>
              </div>

              <Button asChild>
                <Link href="/play">Back to Play</Link>
              </Button>
            </div>

            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                First to {winCondition} cards wins. Final rankings use score first, then turn order
                as the tie-breaker.
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4">
          {rankedPlayers.map((player, index) => {
            const isWinner = player.userId === winner.userId;

            return (
              <div key={player.userId} className="space-y-2">
                <div className="flex items-center gap-2 px-1 text-sm text-slate-200">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                    #{index + 1}
                  </span>
                  <span>{player.displayName}</span>
                  {isWinner ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
                      Winner
                    </span>
                  ) : null}
                </div>

                <GamePlayerTimeline
                  activityBadgeLabel={isWinner ? "Winner" : null}
                  connectionLabel={`Final standing #${String(index + 1)}`}
                  isActive={isWinner}
                  isConnected={connectedUserIds.includes(player.userId)}
                  isCurrentUser={player.userId === currentUserId}
                  player={player}
                  winCondition={winCondition}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
