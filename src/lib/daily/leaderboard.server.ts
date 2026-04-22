// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Server-side query functions for the daily challenge leaderboard.
 * Import from leaderboard.ts for types and browser-client queries.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { DailyLeaderboardEntry, DailyPlayerRank } from "./leaderboard";
import { mapEntry, mapPlayerRank } from "./leaderboard";

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

// ── Server-client queries (for Server Components) ─────────────────────────────

/** Fetches the top `limit` ranked entries for the given challenge (server client). */
export async function fetchDailyLeaderboardServer(
  challengeNumber: number,
  limit = 50,
): Promise<DailyLeaderboardEntry[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_daily_leaderboard", {
    p_challenge_number: challengeNumber,
    p_limit: limit,
  });
  if (error !== null) throw new Error(`get_daily_leaderboard: ${error.message}`);
  return ((data as RpcLeaderboardRow[] | null) ?? []).map(mapEntry);
}

/**
 * Fetches the authenticated player's rank for the given challenge (server client).
 * Returns null if the player has not completed the challenge.
 */
export async function fetchDailyPlayerRankServer(
  challengeNumber: number,
  userId: string,
): Promise<DailyPlayerRank | null> {
  const supabase = await createServerClient();
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
