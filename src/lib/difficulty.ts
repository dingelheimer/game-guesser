// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Difficulty tier definitions and helpers.
 *
 * Mirrors the SQL logic in the `games_by_difficulty` view so that app code
 * can reason about tiers without hitting the database.
 */

export type DifficultyTier = "easy" | "medium" | "hard" | "extreme";

/**
 * Maximum popularity rank that qualifies for each non-extreme tier.
 * Matches the CASE expression in the `games_by_difficulty` SQL view.
 */
export const DIFFICULTY_THRESHOLDS = {
  easy: 10,
  medium: 20,
  hard: 50,
} as const;

/**
 * Map a popularity rank (1 = most popular within a year) to a difficulty tier.
 * Null / undefined ranks are treated as extreme.
 */
export function rankToTier(rank: number | null | undefined): DifficultyTier {
  if (rank === null || rank === undefined) return "extreme";
  if (rank <= DIFFICULTY_THRESHOLDS.easy) return "easy";
  if (rank <= DIFFICULTY_THRESHOLDS.medium) return "medium";
  if (rank <= DIFFICULTY_THRESHOLDS.hard) return "hard";
  return "extreme";
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
