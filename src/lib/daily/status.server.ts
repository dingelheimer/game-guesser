// SPDX-License-Identifier: AGPL-3.0-only
import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Daily challenge display status for the landing page and play page CTAs.
 * The server resolves this from the player's `daily_challenge_results` row.
 */
export type DailyChallengeStatus =
  /** No challenge generated for today (edge case — cron not run yet). */
  | { state: "no_challenge" }
  /** Guest player — challenge exists but no auth to check results. */
  | { state: "guest_cta"; challengeNumber: number; challengeDate: string }
  /** Authenticated player who has not yet started today's challenge. */
  | { state: "not_played"; challengeNumber: number; challengeDate: string }
  /** Authenticated player with a game currently in progress. */
  | { state: "in_progress"; challengeNumber: number; challengeDate: string }
  /** Authenticated player who has completed today's challenge. */
  | {
      state: "completed";
      challengeNumber: number;
      challengeDate: string;
      score: number;
      /** Total placement slots (deck.length - 1). Always 10 for Standard mode. */
      totalCards: number;
      /** Current streak length, or null if the player has no streak row yet. */
      currentStreak: number | null;
    };

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the daily challenge status for the given user.
 *
 * - For guests (`userId = null`): returns `guest_cta` if a challenge exists
 *   today (we cannot check localStorage-based anonymous_id server-side).
 * - For authenticated users: checks `daily_challenge_results` and
 *   `daily_streaks` to determine the exact state.
 */
export async function fetchDailyChallengeStatus(
  userId: string | null,
): Promise<DailyChallengeStatus> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  const { data: challenge } = await supabase
    .from("daily_challenges")
    .select("id, challenge_number, challenge_date, deck")
    .eq("challenge_date", today)
    .maybeSingle();

  if (challenge === null) {
    return { state: "no_challenge" };
  }

  if (userId === null) {
    return {
      state: "guest_cta",
      challengeNumber: challenge.challenge_number,
      challengeDate: challenge.challenge_date,
    };
  }

  const [resultResponse, streakResponse] = await Promise.all([
    supabase
      .from("daily_challenge_results")
      .select("completed, score")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("daily_streaks").select("current_streak").eq("user_id", userId).maybeSingle(),
  ]);

  const result = resultResponse.data;
  const currentStreak = streakResponse.data?.current_streak ?? null;

  if (result === null) {
    return {
      state: "not_played",
      challengeNumber: challenge.challenge_number,
      challengeDate: challenge.challenge_date,
    };
  }

  if (!result.completed) {
    return {
      state: "in_progress",
      challengeNumber: challenge.challenge_number,
      challengeDate: challenge.challenge_date,
    };
  }

  // deck has 11 games: 1 anchor + 10 to place → totalCards = deck.length - 1
  const totalCards = challenge.deck.length - 1;

  return {
    state: "completed",
    challengeNumber: challenge.challenge_number,
    challengeDate: challenge.challenge_date,
    score: result.score,
    totalCards,
    currentStreak,
  };
}
