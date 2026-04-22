// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Types and browser-client query functions for the daily challenge leaderboard.
 * Server-side queries live in leaderboard.server.ts to avoid bundling
 * next/headers into client components.
 */

import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  extraTryUsed: boolean;
  completedAt: string;
}

export interface DailyPlayerRank {
  rank: number;
  score: number;
  extraTryUsed: boolean;
  completedAt: string;
}

// ── Raw RPC row shapes (Supabase returns snake_case) ─────────────────────────

interface RpcLeaderboardRow {
  rank: number;
  user_id: string;
  username: string;
  score: number;
  extra_try_used: boolean;
  completed_at: string;
}

interface RpcPlayerRankRow {
  rank: number;
  score: number;
  extra_try_used: boolean;
  completed_at: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function mapEntry(row: RpcLeaderboardRow): DailyLeaderboardEntry {
  return {
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    score: row.score,
    extraTryUsed: row.extra_try_used,
    completedAt: row.completed_at,
  };
}

export function mapPlayerRank(row: RpcPlayerRankRow): DailyPlayerRank {
  return {
    rank: row.rank,
    score: row.score,
    extraTryUsed: row.extra_try_used,
    completedAt: row.completed_at,
  };
}

// ── Browser-client queries (for client components / hooks) ────────────────────

/** Fetches the top `limit` ranked entries for the given challenge (browser client). */
export async function fetchDailyLeaderboard(
  challengeNumber: number,
  limit = 50,
): Promise<DailyLeaderboardEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_daily_leaderboard", {
    p_challenge_number: challengeNumber,
    p_limit: limit,
  });
  if (error !== null) throw new Error(`get_daily_leaderboard: ${error.message}`);
  return ((data as RpcLeaderboardRow[] | null) ?? []).map(mapEntry);
}

/**
 * Fetches the authenticated player's rank for the given challenge (browser client).
 * Returns null if the player has not completed the challenge or is not authenticated.
 */
export async function fetchDailyPlayerRank(
  challengeNumber: number,
  userId: string,
): Promise<DailyPlayerRank | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_daily_player_rank", {
    p_challenge_number: challengeNumber,
    p_user_id: userId,
  });
  if (error !== null) throw new Error(`get_daily_player_rank: ${error.message}`);
  const rows = (data as RpcPlayerRankRow[] | null) ?? [];
  const first = rows[0];
  if (!first) return null;
  return mapPlayerRank(first);
}
