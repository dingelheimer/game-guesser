// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import Link from "next/link";
import { Loader2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyLeaderboardEntry, DailyPlayerRank } from "@/lib/daily/leaderboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${String(rank)}`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── LeaderboardRow ────────────────────────────────────────────────────────────

interface LeaderboardRowProps {
  entry: DailyLeaderboardEntry;
  isCurrentUser: boolean;
  totalCards?: number;
}

function LeaderboardRow({ entry, isCurrentUser, totalCards = 10 }: LeaderboardRowProps) {
  return (
    <tr
      className={cn(
        isCurrentUser ? "bg-primary-400/10" : "hover:bg-surface-700/50 transition-colors",
      )}
    >
      <td className="text-text-secondary px-3 py-2.5 font-mono text-sm">{rankLabel(entry.rank)}</td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "text-sm font-medium",
            isCurrentUser ? "text-primary-400 font-semibold" : "text-text-primary",
          )}
        >
          {entry.username}
          {isCurrentUser && (
            <span className="text-primary-400 ml-1.5 text-xs font-normal">(you)</span>
          )}
        </span>
      </td>
      <td className="font-display text-text-primary px-3 py-2.5 text-center text-sm font-bold">
        {entry.score}/{totalCards}
        {entry.extraTryUsed ? (
          <span className="ml-1 text-xs" title="Extra try used">
            ❤️
          </span>
        ) : (
          <span className="ml-1 text-xs" title="Clean run">
            💪
          </span>
        )}
      </td>
      <td className="text-text-secondary px-3 py-2.5 text-right text-xs tabular-nums">
        {formatTime(entry.completedAt)}
      </td>
    </tr>
  );
}

// ── DailyLeaderboard ──────────────────────────────────────────────────────────

export interface DailyLeaderboardProps {
  entries: DailyLeaderboardEntry[];
  /** The current authenticated user's rank if they are outside the displayed entries. */
  playerRank: DailyPlayerRank | null;
  /** The current user's ID — null for guests. */
  currentUserId: string | null;
  /** True when displaying a condensed preview (top 10 only). */
  isPreview?: boolean;
  /** Link to the full leaderboard (shown in preview mode). */
  fullLeaderboardHref?: string;
  totalCards?: number;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Renders the daily challenge leaderboard.
 * Works in both preview mode (top 10 + player rank) and full mode (top 50).
 */
export function DailyLeaderboard({
  entries,
  playerRank,
  currentUserId,
  isPreview = false,
  fullLeaderboardHref,
  totalCards = 10,
  isLoading = false,
  error = null,
}: DailyLeaderboardProps) {
  if (isLoading) {
    return (
      <div className="text-text-secondary flex items-center justify-center gap-2 py-6 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading leaderboard…
      </div>
    );
  }

  if (error !== null) {
    return <p className="py-4 text-center text-sm text-rose-400">Could not load leaderboard.</p>;
  }

  const displayEntries = isPreview ? entries.slice(0, 10) : entries;
  const playerInList = currentUserId !== null && entries.some((e) => e.userId === currentUserId);
  const isGuest = currentUserId === null;

  return (
    <div className="space-y-3">
      {displayEntries.length === 0 ? (
        <div className="border-border/50 bg-surface-800 rounded-xl border p-6 text-center">
          <Trophy className="text-text-disabled mx-auto mb-2 h-8 w-8" />
          <p className="text-text-secondary text-sm">No scores yet — be the first!</p>
        </div>
      ) : (
        <div className="bg-surface-800/60 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-text-secondary px-3 py-2 text-left text-xs font-medium tracking-wide uppercase">
                  Rank
                </th>
                <th className="text-text-secondary px-3 py-2 text-left text-xs font-medium tracking-wide uppercase">
                  Player
                </th>
                <th className="text-text-secondary px-3 py-2 text-center text-xs font-medium tracking-wide uppercase">
                  Score
                </th>
                <th className="text-text-secondary px-3 py-2 text-right text-xs font-medium tracking-wide uppercase">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((entry) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  isCurrentUser={currentUserId !== null && entry.userId === currentUserId}
                  totalCards={totalCards}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Player's rank if outside the displayed list */}
      {!playerInList && playerRank !== null && (
        <div className="border-primary-500/20 bg-primary-500/5 rounded-xl border px-3 py-2.5">
          <p className="text-sm">
            <span className="text-text-secondary">Your rank: </span>
            <span className="font-display text-primary-400 font-bold">
              #{String(playerRank.rank)}
            </span>
            <span className="text-text-secondary ml-2">
              — {playerRank.score}/{totalCards}
              {playerRank.extraTryUsed ? " ❤️" : " 💪"}
            </span>
          </p>
        </div>
      )}

      {/* Guest sign-up prompt */}
      {isGuest && (
        <div className="bg-surface-800/40 text-text-secondary rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs">
          <Link
            href="/auth/sign-up"
            className="text-primary-400 underline-offset-2 hover:underline"
          >
            Sign up
          </Link>{" "}
          to appear on the leaderboard and track your streak.
        </div>
      )}

      {/* View full leaderboard link (preview mode only) */}
      {isPreview && fullLeaderboardHref !== undefined && entries.length > 0 && (
        <div className="text-center">
          <Link
            href={fullLeaderboardHref}
            className="text-primary-400 text-xs underline-offset-2 hover:underline"
          >
            View full leaderboard →
          </Link>
        </div>
      )}
    </div>
  );
}
