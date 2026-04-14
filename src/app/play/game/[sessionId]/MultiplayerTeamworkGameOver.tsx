"use client";

import type { MultiplayerTimelineCard } from "@/lib/multiplayer/gamePage";

interface MultiplayerTeamworkGameOverProps {
  finalTeamScore: number;
  finalTeamTimeline: readonly MultiplayerTimelineCard[];
  teamWin: boolean;
}

/**
 * Game-over screen for TEAMWORK Co-op mode.
 * Shows either a victory or elimination message with the final team score.
 */
export function MultiplayerTeamworkGameOver({
  finalTeamScore,
  finalTeamTimeline,
  teamWin,
}: MultiplayerTeamworkGameOverProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="text-6xl">{teamWin ? "🏆" : "💀"}</div>
      <div>
        <h2 className="mb-2 text-3xl font-bold">{teamWin ? "Team Wins!" : "Team Eliminated"}</h2>
        <p className="text-muted-foreground">
          {teamWin
            ? `You reached ${String(finalTeamScore)} correct placements — well played!`
            : `The team ran out of tokens with ${String(finalTeamScore)} correct placements.`}
        </p>
      </div>

      {finalTeamTimeline.length > 0 && (
        <div className="w-full max-w-md">
          <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
            Final Team Timeline ({finalTeamTimeline.length} cards)
          </h3>
          <div className="flex flex-col gap-1">
            {finalTeamTimeline.map((card) => (
              <div
                key={card.gameId}
                className="bg-muted/50 flex items-center justify-between rounded px-3 py-2 text-sm"
              >
                <span>{card.title}</span>
                <span className="text-muted-foreground font-mono">{card.releaseYear}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
