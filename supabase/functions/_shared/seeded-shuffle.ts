/**
 * Deterministic seeded PRNG and Fisher-Yates shuffle for daily challenge
 * deck generation.
 *
 * Used by both `daily-generate` (cron) and `daily-start` (fallback).
 * All functions are pure with no I/O.
 */

/**
 * Mulberry32 — fast, deterministic 32-bit PRNG.
 *
 * @param seed - 32-bit integer seed
 * @returns A stateful generator function that returns floats in [0, 1)
 */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle using a seeded PRNG.
 *
 * Given the same `array` and `seed`, always returns the same permutation.
 *
 * @param array - input array (not mutated)
 * @param seed  - integer seed passed to mulberry32
 * @returns a new shuffled array
 */
export function seededShuffle<T>(array: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  return shuffled;
}

/**
 * Compute the challenge number (1-based sequential day index) from a launch
 * date and a target date.
 *
 * Both dates must be UTC date strings in `YYYY-MM-DD` format.
 * Returns 1 for the launch date itself, 2 for the day after, etc.
 * Returns 0 or negative for dates before the launch date — callers should
 * skip those dates rather than inserting them.
 *
 * @param launchDateIso - ISO date string of the first challenge day (e.g. "2026-05-01")
 * @param targetDateIso - ISO date string of the date to compute for
 * @returns challenge number (1 for launch date, 2+ for subsequent days, ≤0 for pre-launch)
 */
export function computeChallengeNumber(launchDateIso: string, targetDateIso: string): number {
  const launch = Date.parse(launchDateIso);
  const target = Date.parse(targetDateIso);
  const diffDays = Math.floor((target - launch) / 86_400_000);
  return diffDays + 1;
}

/**
 * Return today's UTC date as an ISO date string (YYYY-MM-DD).
 */
export function utcDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
