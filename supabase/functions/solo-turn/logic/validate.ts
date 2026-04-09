/**
 * Pure placement-validation logic for the solo-turn Edge Function.
 * No I/O — all dependencies injected for testability.
 */

/** A placed card entry in the timeline. */
export interface TimelineEntry {
  game_id: number;
  release_year: number;
}

/**
 * Check whether placing a card with `newYear` at `position` is valid.
 *
 * `position` is 0-indexed:
 *   - 0 = before all existing cards
 *   - N = after all N existing cards
 *
 * A placement is valid when:
 *   prevCard.release_year <= newYear <= nextCard.release_year
 *
 * The same-year adjacency rule ("placing next to a card with the same year
 * counts as correct") is naturally covered by the >= / <= comparisons.
 *
 * Returns false for out-of-range positions.
 */
export function isValidPlacement(
  timeline: readonly TimelineEntry[],
  newYear: number,
  position: number,
): boolean {
  if (position < 0 || position > timeline.length) return false;

  const prevYear = position > 0 ? timeline[position - 1]!.release_year : -Infinity;
  const nextYear =
    position < timeline.length ? timeline[position]!.release_year : Infinity;

  return newYear >= prevYear && newYear <= nextYear;
}

/**
 * Return every valid insertion index for a card with `newYear` in the
 * current timeline.  At least one index is always valid (the full range
 * covers −∞ to +∞).
 */
export function findValidPositions(
  timeline: readonly TimelineEntry[],
  newYear: number,
): number[] {
  const valid: number[] = [];
  for (let i = 0; i <= timeline.length; i++) {
    if (isValidPlacement(timeline, newYear, i)) {
      valid.push(i);
    }
  }
  return valid;
}
