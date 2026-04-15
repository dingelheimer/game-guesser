// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  MultiplayerGamePagePlayer,
  MultiplayerTimelineCard,
} from "@/lib/multiplayer/gamePage";

interface TeamVotingPanelProps {
  /** Current player's user ID. */
  currentUserId: string;
  /** Per-player vote state keyed by userId. */
  votes: Readonly<Record<string, Readonly<{ position: number; locked: boolean }>>>;
  /** All players in the game (for display names and colors). */
  players: readonly MultiplayerGamePagePlayer[];
  /** The shared team timeline used for position reference. */
  teamTimeline: readonly MultiplayerTimelineCard[];
  /** Whether the current player is submitting a vote (disables UI). */
  isSubmitting: boolean;
  /** Called when the current player changes their proposed position. */
  onPositionChange: (position: number) => void;
  /** Called when the current player locks in their vote. */
  onLockIn: (position: number) => void;
}

const PLAYER_COLORS = [
  "text-blue-500",
  "text-green-500",
  "text-yellow-500",
  "text-red-500",
  "text-purple-500",
  "text-pink-500",
];

/**
 * Renders the team voting panel for TEAMWORK mode.
 * Each player proposes a position and locks in when ready.
 * Once all connected players have locked, the vote resolves automatically.
 */
export function TeamVotingPanel({
  currentUserId,
  votes,
  players,
  teamTimeline,
  isSubmitting,
  onPositionChange,
  onLockIn,
}: TeamVotingPanelProps) {
  const myVote = votes[currentUserId];
  const [selectedPosition, setSelectedPosition] = useState<number>(myVote?.position ?? 0);
  const isLocked = myVote?.locked ?? false;

  const playerColorMap = new Map(
    players.map((player, index) => [player.userId, PLAYER_COLORS[index % PLAYER_COLORS.length]]),
  );
  const playerNameMap = new Map(players.map((player) => [player.userId, player.displayName]));

  const voteCounts: Record<number, string[]> = {};
  for (const [playerId, vote] of Object.entries(votes)) {
    const existing = voteCounts[vote.position];
    if (existing === undefined) {
      voteCounts[vote.position] = [playerId];
    } else {
      existing.push(playerId);
    }
  }

  const totalSlots = teamTimeline.length + 1;

  function handlePositionSelect(position: number) {
    if (isLocked || isSubmitting) {
      return;
    }

    setSelectedPosition(position);
    onPositionChange(position);
  }

  function handleLockIn() {
    if (isSubmitting) {
      return;
    }

    onLockIn(selectedPosition);
  }

  const lockedCount = Object.values(votes).filter((v) => v.locked).length;
  const totalVoters = players.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-muted-foreground text-sm">
          Vote on where this game belongs in the shared timeline
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {lockedCount}/{totalVoters} locked in
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {Array.from({ length: totalSlots }, (_, slotIndex) => {
          const beforeCard = teamTimeline[slotIndex - 1];
          const afterCard = teamTimeline[slotIndex];
          const votersHere = voteCounts[slotIndex] ?? [];
          const isSelected = selectedPosition === slotIndex;

          return (
            <div key={slotIndex}>
              {slotIndex > 0 && beforeCard !== undefined && (
                <div className="bg-muted/50 rounded px-2 py-1 text-center text-sm">
                  {beforeCard.title} ({beforeCard.releaseYear})
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  handlePositionSelect(slotIndex);
                }}
                disabled={isLocked || isSubmitting}
                className={[
                  "flex w-full items-center justify-between rounded border-2 px-3 py-2 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/30 hover:border-muted-foreground/60 border-dashed",
                  isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="text-muted-foreground text-xs">
                  {slotIndex === 0
                    ? "Before all"
                    : slotIndex === teamTimeline.length
                      ? "After all"
                      : `Position ${String(slotIndex + 1)}`}
                </span>
                <span className="flex gap-1">
                  {votersHere.map((playerId) => (
                    <span
                      key={playerId}
                      className={[
                        "text-xs font-bold",
                        playerColorMap.get(playerId) ?? "text-muted-foreground",
                        votes[playerId]?.locked === true ? "opacity-100" : "opacity-50",
                      ].join(" ")}
                      title={`${playerNameMap.get(playerId) ?? "?"} — ${votes[playerId]?.locked === true ? "locked" : "considering"}`}
                    >
                      ●
                    </span>
                  ))}
                </span>
              </button>
              {slotIndex < teamTimeline.length && afterCard !== undefined && (
                <div className="bg-muted/50 rounded px-2 py-1 text-center text-sm">
                  {afterCard.title} ({afterCard.releaseYear})
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleLockIn}
        disabled={isLocked || isSubmitting}
        variant={isLocked ? "secondary" : "default"}
        className="w-full"
      >
        {isLocked ? "Locked In ✓" : "Lock In"}
      </Button>

      {Object.keys(votes).length > 0 && (
        <div className="text-muted-foreground space-y-1 text-xs">
          {players.map((player) => {
            const vote = votes[player.userId];
            return (
              <div
                key={player.userId}
                className={["flex justify-between", playerColorMap.get(player.userId)].join(" ")}
              >
                <span>{player.displayName}</span>
                <span>
                  {vote === undefined
                    ? "—"
                    : `Position ${String(vote.position + 1)}${vote.locked ? " ✓" : ""}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
