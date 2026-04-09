/**
 * Pure turn-processing logic for the solo-turn Edge Function.
 * No I/O — all dependencies injected for testability.
 */

import { findValidPositions, isValidPlacement } from "./validate.ts";
import type { TimelineEntry } from "./validate.ts";

export type { TimelineEntry };

/** Snapshot of session fields needed to process a turn. */
export interface SessionSnapshot {
  score: number;
  turns_played: number;
  current_streak: number;
  best_streak: number;
  /** deck[0] is the game_id of the card currently being placed. */
  deck: number[];
  timeline: TimelineEntry[];
}

/** Result returned by processTurn. */
export interface TurnResult {
  correct: boolean;
  game_over: boolean;
  new_score: number;
  new_turns_played: number;
  new_current_streak: number;
  new_best_streak: number;
  new_timeline: TimelineEntry[];
  /** Remaining deck after this turn (deck[0] will be the next card). */
  new_deck: number[];
  /**
   * All valid positions for the placed card.
   * Populated only on incorrect placements so the UI can highlight the
   * correct range on the game-over screen.
   */
  valid_positions?: number[];
}

/**
 * Process one placement turn.
 *
 * @param session - current session snapshot (read-only)
 * @param newYear - release year of the card the player just placed
 * @param position - 0-indexed position in the timeline where they placed it
 * @throws if deck is empty (caller must validate session status first)
 */
export function processTurn(
  session: SessionSnapshot,
  newYear: number,
  position: number,
): TurnResult {
  const { deck, timeline, score, turns_played, current_streak, best_streak } = session;

  if (deck.length === 0) {
    throw new Error("Cannot process a turn: session deck is empty");
  }

  const correct = isValidPlacement(timeline, newYear, position);
  const newTurnsPlayed = turns_played + 1;

  if (!correct) {
    return {
      correct: false,
      game_over: true,
      new_score: score,
      new_turns_played: newTurnsPlayed,
      new_current_streak: 0,
      new_best_streak: best_streak,
      new_timeline: timeline,
      new_deck: deck,
      valid_positions: findValidPositions(timeline, newYear),
    };
  }

  const currentGameId = deck[0]!;
  const newTimeline: TimelineEntry[] = [
    ...timeline.slice(0, position),
    { game_id: currentGameId, release_year: newYear },
    ...timeline.slice(position),
  ];
  const newDeck = deck.slice(1);
  const newCurrentStreak = current_streak + 1;
  const newBestStreak = Math.max(best_streak, newCurrentStreak);
  const newScore = score + 1;
  // Game is over only when the deck is exhausted (all games placed correctly).
  const gameOver = newDeck.length === 0;

  return {
    correct: true,
    game_over: gameOver,
    new_score: newScore,
    new_turns_played: newTurnsPlayed,
    new_current_streak: newCurrentStreak,
    new_best_streak: newBestStreak,
    new_timeline: newTimeline,
    new_deck: newDeck,
  };
}
