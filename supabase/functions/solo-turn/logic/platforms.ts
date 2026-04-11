/**
 * Pure logic for building platform bonus options.
 * No database dependencies — injectable RNG for deterministic testing.
 */

export interface PlatformOption {
  id: number;
  name: string;
}

/** Minimum total platform options shown to the player. */
export const MIN_OPTIONS = 8;
/** Maximum total options when the game has fewer than MIN_OPTIONS correct platforms. */
export const MAX_OPTIONS_NORMAL = 12;
/** Maximum total options when the game has many correct platforms (≥ MIN_OPTIONS). */
export const MAX_OPTIONS_MANY = 14;
/** Maximum distractors added when game has many correct platforms. */
const MAX_EXTRA_DISTRACTORS = 4;

/**
 * How many distractor platforms to request from the database.
 * Callers should request this many distractors so buildPlatformOptions
 * has enough to work with.
 */
export function maxDistractorsNeeded(correctCount: number): number {
  if (correctCount >= MIN_OPTIONS) {
    // Add up to MAX_EXTRA_DISTRACTORS, capped so total does not exceed MAX_OPTIONS_MANY.
    return Math.max(0, Math.min(MAX_EXTRA_DISTRACTORS, MAX_OPTIONS_MANY - correctCount));
  }
  // Fill up to MAX_OPTIONS_NORMAL.
  return Math.max(0, MAX_OPTIONS_NORMAL - correctCount);
}

/**
 * Combine correct platforms with distractor platforms into a shuffled options
 * list, applying count limits from the research spec.
 *
 * @param correct   All correct platforms for the game (with display names applied).
 * @param distractors  Candidate distractor platforms (with display names applied).
 *                     Should contain at least maxDistractorsNeeded(correct.length) items;
 *                     extras are ignored.
 * @param rng  Random number generator (default: Math.random).
 */
export function buildPlatformOptions(
  correct: PlatformOption[],
  distractors: PlatformOption[],
  rng: () => number = Math.random,
): { options: PlatformOption[]; correctIds: number[] } {
  const correctIds = correct.map((p) => p.id);
  const needed = maxDistractorsNeeded(correct.length);
  const selectedDistractors = distractors.slice(0, needed);
  const combined = shuffleArray([...correct, ...selectedDistractors], rng);
  return { options: combined, correctIds };
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}
