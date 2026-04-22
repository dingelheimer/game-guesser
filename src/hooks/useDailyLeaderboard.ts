// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Client-side hook for fetching the daily leaderboard and the current player's rank.
 * Uses the Supabase browser client so it works inside client components.
 */

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchDailyLeaderboard,
  fetchDailyPlayerRank,
  type DailyLeaderboardEntry,
  type DailyPlayerRank,
} from "@/lib/daily/leaderboard";

export interface DailyLeaderboardState {
  entries: DailyLeaderboardEntry[];
  /** The current authenticated user's rank — null if outside top 50 no entry, or not authenticated. */
  playerRank: DailyPlayerRank | null;
  /** The current authenticated user's ID — null for guests. */
  currentUserId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches the daily leaderboard for the given challenge number.
 * Also fetches the current user's rank if they are authenticated and not in
 * the top `limit` results.
 */
export function useDailyLeaderboard(
  challengeNumber: number | null,
  limit = 50,
): DailyLeaderboardState {
  const [state, setState] = useState<DailyLeaderboardState>({
    entries: [],
    playerRank: null,
    currentUserId: null,
    isLoading: challengeNumber !== null,
    error: null,
  });

  useEffect(() => {
    if (challengeNumber === null) return;

    const cn = challengeNumber;
    let active = true;

    async function load() {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const supabase = createClient();
        const [entries, { data: userData }] = await Promise.all([
          fetchDailyLeaderboard(cn, limit),
          supabase.auth.getUser(),
        ]);

        const userId = userData.user?.id ?? null;

        // Check if the current user appears in the top results.
        const inTopResults = userId !== null && entries.some((e) => e.userId === userId);

        // If authenticated but not in the top results, fetch their rank separately.
        let playerRank: DailyPlayerRank | null = null;
        if (userId !== null && !inTopResults) {
          playerRank = await fetchDailyPlayerRank(cn, userId);
        }

        if (active) {
          setState({ entries, playerRank, currentUserId: userId, isLoading: false, error: null });
        }
      } catch (err) {
        if (active) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : "Failed to load leaderboard",
          }));
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [challengeNumber, limit]);

  return state;
}
