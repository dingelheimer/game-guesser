/**
 * Pure turn-processing logic for the daily-turn Edge Function.
 * No I/O — fully testable with Vitest.
 */

import { findValidPositions, isValidPlacement } from "../../solo-turn/logic/validate.ts";
import type { TimelineEntry } from "../../solo-turn/logic/validate.ts";

export type { TimelineEntry };

/** Number of placement cards per daily challenge (excludes the anchor). */
export const TOTAL_PLACEMENT_CARDS = 10;

/**
 * Compute the deck index of the card currently waiting to be placed.
 *
 * Deck layout:
 *   deck[0]  = anchor card (always revealed at game start)
 *   deck[1]  = 1st card to place  (turns_played = 0)
 *   deck[10] = 10th card to place (turns_played = 9)
 *
 * @param turnsPlayed - number of placement turns already completed (0–9)
 * @returns index into the challenge deck array (1–10)
 */
export function getCurrentCardDeckIndex(turnsPlayed: number): number {
  return 1 + turnsPlayed;
}

/** A single turn record stored in daily_challenge_results.placements. */
export interface PlacementRecord {
  game_id: number;
  position: number;
  correct: boolean;
  /** True when this wrong placement consumed the extra try (game continues). */
  extra_try?: boolean;
  /** All valid positions for the card — present on incorrect placements. */
  valid_positions?: number[];
}

/** Snapshot of result fields needed to process one daily turn. */
export interface DailyTurnSnapshot {
  score: number;
  turns_played: number;
  /** Whether the one allowed extra try has already been used. */
  extra_try_used: boolean;
  timeline: readonly TimelineEntry[];
  placements: readonly PlacementRecord[];
}

/** Result returned by processDailyTurn. */
export interface DailyTurnResult {
  correct: boolean;
  /** True when the game ends (all 10 placed OR second wrong placement). */
  game_over: boolean;
  new_score: number;
  new_turns_played: number;
  new_extra_try_used: boolean;
  new_timeline: TimelineEntry[];
  new_placements: PlacementRecord[];
  /** All valid positions — populated only on incorrect placements. */
  valid_positions?: number[];
}

/**
 * Process one placement turn in a daily challenge.
 *
 * Extra-try mechanic:
 *   - First wrong placement: `extra_try_used` → true; card is discarded and
 *     game continues (game_over = false).
 *   - Second wrong placement: game ends immediately (game_over = true).
 *
 * @param snapshot - current state of the result row (read-only)
 * @param gameId   - game ID of the card being placed
 * @param cardYear - release year of the card being placed
 * @param position - 0-indexed insertion position in the timeline
 */
export function processDailyTurn(
  snapshot: DailyTurnSnapshot,
  gameId: number,
  cardYear: number,
  position: number,
): DailyTurnResult {
  const { score, turns_played, extra_try_used, timeline, placements } = snapshot;

  const correct = isValidPlacement(timeline, cardYear, position);
  const newTurnsPlayed = turns_played + 1;

  if (correct) {
    const newTimeline: TimelineEntry[] = [
      ...timeline.slice(0, position),
      { game_id: gameId, release_year: cardYear },
      ...timeline.slice(position),
    ];
    const newPlacements: PlacementRecord[] = [
      ...placements,
      { game_id: gameId, position, correct: true },
    ];

    return {
      correct: true,
      game_over: newTurnsPlayed === TOTAL_PLACEMENT_CARDS,
      new_score: score + 1,
      new_turns_played: newTurnsPlayed,
      new_extra_try_used: extra_try_used,
      new_timeline: newTimeline,
      new_placements: newPlacements,
    };
  }

  const validPositions = findValidPositions(timeline, cardYear);

  if (!extra_try_used) {
    // First wrong placement — consume extra try, game continues.
    return {
      correct: false,
      game_over: false,
      new_score: score,
      new_turns_played: newTurnsPlayed,
      new_extra_try_used: true,
      new_timeline: [...timeline],
      new_placements: [
        ...placements,
        {
          game_id: gameId,
          position,
          correct: false,
          extra_try: true,
          valid_positions: validPositions,
        },
      ],
      valid_positions: validPositions,
    };
  }

  // Second wrong placement — game over.
  return {
    correct: false,
    game_over: true,
    new_score: score,
    new_turns_played: newTurnsPlayed,
    new_extra_try_used: true,
    new_timeline: [...timeline],
    new_placements: [
      ...placements,
      { game_id: gameId, position, correct: false, valid_positions: validPositions },
    ],
    valid_positions: validPositions,
  };
}
