// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Difficulty tier definitions and helpers.
 *
 * Mirrors the SQL logic in the `games_by_difficulty` view so that app code
 * can reason about tiers without hitting the database.
 */

export type DifficultyTier = "easy" | "medium" | "hard" | "extreme" | "god_gamer";

/**
 * Maximum `popularity_rank_per_year` that qualifies for each tier.
 * Controls how large the eligible game pool is for each difficulty.
 */
export const DIFFICULTY_THRESHOLDS = {
  easy: 2,
  medium: 5,
  hard: 10,
  extreme: 50,
  god_gamer: 100,
} as const;

/**
 * Map a popularity rank (1 = most popular within a year) to a difficulty tier.
 * Null / undefined ranks are treated as god_gamer.
 */
export function rankToTier(rank: number | null | undefined): DifficultyTier {
  if (rank === null || rank === undefined) return "god_gamer";
  if (rank <= DIFFICULTY_THRESHOLDS.easy) return "easy";
  if (rank <= DIFFICULTY_THRESHOLDS.medium) return "medium";
  if (rank <= DIFFICULTY_THRESHOLDS.hard) return "hard";
  if (rank <= DIFFICULTY_THRESHOLDS.extreme) return "extreme";
  return "god_gamer";
}

/**
 * Compute the composite popularity score from raw game metrics.
 *
 * Formula: rating_count × 1.0 + follows × 0.5 + hypes × 0.2
 * Mirrors the UPDATE in `compute_popularity_scores()` SQL function.
 */
export function computePopularityScore(
  ratingCount: number,
  follows: number,
  hypes: number,
): number {
  return ratingCount * 1.0 + follows * 0.5 + hypes * 0.2;
}
