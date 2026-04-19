/**
 * Pure turn-processing logic for the solo-turn Edge Function.
 * No I/O — all dependencies injected for testability.
 */

import { findValidPositions, isCorrectGuess, isValidPlacement } from "./validate.ts";
import type { HigherLowerGuess, TimelineEntry } from "./validate.ts";

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

/**
 * Process one Higher Lower turn.
 *
 * The session timeline contains exactly one entry (the reference card). The
 * player guesses whether the hidden card is newer ("higher") or older
 * ("lower") than the reference. On a correct guess the hidden card becomes
 * the new sole reference; on an incorrect guess the game ends.
 *
 * @param session      - current session snapshot (read-only)
 * @param referenceYear - release year of the current reference card (timeline[0])
 * @param newYear       - release year of the card the player is guessing
 * @param guess         - player's direction guess
 * @throws if deck is empty (caller must validate session status first)
 */
export function processHigherLowerTurn(
  session: SessionSnapshot,
  referenceYear: number,
  newYear: number,
  guess: HigherLowerGuess,
): TurnResult {
  const { deck, score, turns_played, current_streak, best_streak, timeline } = session;

  if (deck.length === 0) {
    throw new Error("Cannot process a turn: session deck is empty");
  }

  const currentGameId = deck[0]!;
  const correct = isCorrectGuess(referenceYear, newYear, guess);
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
    };
  }

  const newTimeline: TimelineEntry[] = [{ game_id: currentGameId, release_year: newYear }];
  const newDeck = deck.slice(1);
  const newCurrentStreak = current_streak + 1;
  const newBestStreak = Math.max(best_streak, newCurrentStreak);
  const newScore = score + 1;
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

/**
 * Apply the draw-time swap for the Higher Lower variant.
 *
 * Scans the front of `deck` for a card whose year differs from
 * `referenceYear`. If the front card already differs, the deck is returned
 * unchanged. If a different-year card is found further in the deck, it is
 * swapped to the front. If all remaining cards share `referenceYear`, the
 * player has won (no distinguishable draws remain) — returns `null`.
 *
 * @param deck          - remaining game IDs after the current turn
 * @param deckYears     - map of gameId → release year for all cards in `deck`
 * @param referenceYear - release year of the new reference card
 * @returns swapped deck, or `null` if all-same-year (player wins)
 */
export function applyDrawTimeSwap(
  deck: readonly number[],
  deckYears: ReadonlyMap<number, number>,
  referenceYear: number,
): number[] | null {
  if (deck.length === 0) return [];

  const frontYear = deckYears.get(deck[0]!) ?? referenceYear;
  if (frontYear !== referenceYear) return [...deck];

  for (let i = 1; i < deck.length; i++) {
    const year = deckYears.get(deck[i]!) ?? referenceYear;
    if (year !== referenceYear) {
      const result = [...deck];
      const tmp = result[0]!;
      result[0] = result[i]!;
      result[i] = tmp;
      return result;
    }
  }

  return null;
}
