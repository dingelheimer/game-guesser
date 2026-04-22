/**
 * Pure domain types and logic for the daily-start Edge Function.
 * No I/O — fully testable with Vitest.
 */

/** Number of placement cards per daily challenge (excludes the anchor). */
export const TOTAL_PLACEMENT_CARDS = 10;

/** Total deck size: 1 anchor + 10 placement cards. */
export const DECK_SIZE = 11;

/** A placed-card entry in the growing timeline. */
export interface TimelineEntry {
  game_id: number;
  release_year: number;
}

/** A single turn record stored in daily_challenge_results.placements. */
export interface PlacementRecord {
  game_id: number;
  position: number;
  correct: boolean;
  extra_try?: boolean;
  valid_positions?: number[];
}

/**
 * Compute the deck index of the card currently waiting to be placed.
 *
 * Deck layout:
 *   deck[0]  = anchor card (always revealed at game start)
 *   deck[1]  = 1st card to place  (turns_played = 0)
 *   deck[2]  = 2nd card to place  (turns_played = 1)
 *   …
 *   deck[10] = 10th card to place (turns_played = 9)
 *
 * @param turnsPlayed - number of placement turns already completed (0–9)
 * @returns index into the challenge deck array (1–10)
 */
export function getCurrentCardDeckIndex(turnsPlayed: number): number {
  return 1 + turnsPlayed;
}

/**
 * Return whether the challenge is still actively in progress.
 *
 * A challenge is in-progress when:
 *   - it has not been marked completed
 *   - turns_played is in the valid range [0, TOTAL_PLACEMENT_CARDS)
 */
export function isInProgress(turnsPlayed: number, completed: boolean): boolean {
  return !completed && turnsPlayed >= 0 && turnsPlayed < TOTAL_PLACEMENT_CARDS;
}
