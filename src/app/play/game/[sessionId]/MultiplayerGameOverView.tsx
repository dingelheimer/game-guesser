// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import Link from "next/link";
import { Crown, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { DifficultyTier } from "@/lib/difficulty";
import type { MultiplayerGamePagePlayer } from "@/lib/multiplayer/gamePage";
import { sortPlayersByStanding } from "@/lib/multiplayer/rankings";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildMultiplayerShareText,
  shareResult,
  type ShareOutcome,
  type ShareYearRange,
} from "@/lib/share";
import { buildShareResultUrl } from "@/lib/shareResult";
import { GamePlayerTimeline } from "./GamePlayerTimeline";

/**
 * Props for the multiplayer end-of-game standings screen.
 */
export type MultiplayerGameOverViewProps = Readonly<{
  connectedUserIds: readonly string[];
  currentUserId: string;
  difficulty: DifficultyTier;
  players: readonly MultiplayerGamePagePlayer[];
  shareOutcomes: readonly ShareOutcome[];
  sharePlatformBonusEarned: number;
  sharePlatformBonusOpportunities: number;
  shareYearRange: ShareYearRange | null;
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
  difficulty,
  players,
  shareOutcomes,
  sharePlatformBonusEarned,
  sharePlatformBonusOpportunities,
  shareYearRange,
  winCondition,
  winner,
}: MultiplayerGameOverViewProps) {
  const rankedPlayers = sortPlayersByStanding(players);
  const currentPlacement = rankedPlayers.findIndex((player) => player.userId === currentUserId) + 1;
  const currentPlayer = rankedPlayers.find((player) => player.userId === currentUserId);
  const shareUrl =
    currentPlayer === undefined || shareYearRange === null
      ? null
      : buildShareResultUrl({
          difficulty,
          mode: "multiplayer",
          outcomes: shareOutcomes,
          platformBonusEarned: sharePlatformBonusEarned,
          platformBonusOpportunities: sharePlatformBonusOpportunities,
          placement: currentPlacement,
          playerCount: rankedPlayers.length,
          score: currentPlayer.score,
          turnsPlayed: shareOutcomes.length,
          yearRange: shareYearRange,
        });
  const shareSummary =
    currentPlayer === undefined || shareUrl === null
      ? ""
      : buildMultiplayerShareText({
          outcomes: shareOutcomes,
          placement: currentPlacement,
          playerCount: rankedPlayers.length,
          platformBonusEarned: sharePlatformBonusEarned,
          platformBonusOpportunities: sharePlatformBonusOpportunities,
          score: currentPlayer.score,
          turnsPlayed: shareOutcomes.length,
          url: shareUrl,
        });

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

        {currentPlayer !== undefined ? (
          <Card className="border-border/60 bg-surface-800/70">
            <CardHeader className="gap-4">
              <div className="space-y-2">
                <CardTitle className="text-xl">Share your result</CardTitle>
                <CardDescription>
                  Post your finish without revealing any game titles or screenshots.
                </CardDescription>
              </div>

              <pre className="bg-surface-900/80 text-text-primary overflow-x-auto rounded-xl p-3 font-mono text-sm break-words whitespace-pre-wrap">
                {shareSummary}
              </pre>

              <Button
                onClick={() => {
                  void shareResult({
                    navigator,
                    notify: toast,
                    text: shareSummary,
                    ...(shareUrl === null ? {} : { url: shareUrl }),
                  });
                }}
                disabled={shareSummary.length === 0}
                variant="secondary"
              >
                <Share2 className="size-4" aria-hidden="true" />
                Share Result
              </Button>
            </CardHeader>
          </Card>
        ) : null}

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
