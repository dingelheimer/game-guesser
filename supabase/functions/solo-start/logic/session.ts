/**
 * Pure session-building logic for the solo-start Edge Function.
 * No I/O — all dependencies injected for testability.
 */

/** A game eligible to be added to the deck. */
export interface EligibleGame {
  id: number;
  release_year: number;
}

/** The initial session state produced by buildInitialSession. */
export interface InitialSessionState {
  /**
   * Shuffled deck of game IDs still to be drawn.
   * deck[0] is the current card the player must place first.
   * The anchor card has already been placed and is NOT in the deck.
   */
  deck: number[];
  /** The anchor card: placed on the timeline immediately, shown revealed. */
  anchor: EligibleGame;
}

/**
 * Shuffle an array in-place using Fisher-Yates.
 * Accepts an injectable RNG for deterministic testing.
 */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * Build the initial session state from a pool of eligible games.
 * - Shuffles the pool.
 * - Takes the first game as the anchor (placed revealed on the timeline).
 * - The remaining games form the deck (deck[0] = first card to place).
 *
 * @throws if the pool has fewer than 2 games.
 */
export function buildInitialSession(
  games: EligibleGame[],
  rng: () => number = Math.random,
): InitialSessionState {
  if (games.length < 2) {
    throw new Error(
      `Need at least 2 eligible games to start a session, got ${games.length.toString()}`,
    );
  }
  const shuffled = shuffle(games, rng);
  const anchor = shuffled[0]!;
  const deck = shuffled.slice(1).map((g) => g.id);
  return { anchor, deck };
}
