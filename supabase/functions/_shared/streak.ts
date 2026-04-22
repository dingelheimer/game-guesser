/**
 * Pure streak computation logic for the daily challenge.
 * No I/O — fully testable.
 */

/** A row from the daily_streaks table. */
export interface StreakRow {
  current_streak: number;
  best_streak: number;
  last_played: string | null; // YYYY-MM-DD UTC, or null on first play
}

/** Fields written back to daily_streaks after a completion. */
export interface StreakUpdate {
  current_streak: number;
  best_streak: number;
  last_played: string; // YYYY-MM-DD UTC
}

/**
 * Compute the YYYY-MM-DD string for the day before the given date.
 *
 * @param dateStr - a YYYY-MM-DD UTC date string
 * @returns the previous day as YYYY-MM-DD
 */
export function getYesterday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().substring(0, 10);
}

/**
 * Compute the new streak values after a player completes today's challenge.
 *
 * Rules:
 *   - `last_played == today`     → no change (idempotent; already played today)
 *   - `last_played == yesterday` → `current_streak + 1` (streak continues)
 *   - otherwise                  → `current_streak = 1` (streak broken or first play)
 * `best_streak` is always updated to `MAX(best_streak, new_current_streak)`.
 * `last_played` is always set to `today`.
 *
 * @param existing - current streak row, or null if this is the player's first play
 * @param today    - today's UTC date as YYYY-MM-DD
 * @returns the updated streak values to write back
 */
export function computeStreakUpdate(existing: StreakRow | null, today: string): StreakUpdate {
  const row = existing ?? { current_streak: 0, best_streak: 0, last_played: null };

  // Idempotent — player already completed today, do not re-increment.
  if (row.last_played === today) {
    return {
      current_streak: row.current_streak,
      best_streak: row.best_streak,
      last_played: today,
    };
  }

  const yesterday = getYesterday(today);
  const newCurrentStreak = row.last_played === yesterday ? row.current_streak + 1 : 1;
  const newBestStreak = Math.max(row.best_streak, newCurrentStreak);

  return {
    current_streak: newCurrentStreak,
    best_streak: newBestStreak,
    last_played: today,
  };
}
