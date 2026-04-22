// SPDX-License-Identifier: AGPL-3.0-only
import type { DailyPlacementRecord, DailyStreakData } from "@/lib/daily/api";

/** Parameters for generating the daily challenge share text. */
export interface DailyShareParams {
  challengeNumber: number;
  score: number;
  totalCards: number;
  /** True when the player used their one extra try at some point during the game. */
  extraTryUsed: boolean;
  placements: readonly DailyPlacementRecord[];
  /** Streak data for authenticated users; null for guests. */
  streak: DailyStreakData | null;
}

/**
 * Generates a spoiler-free, Wordle-style share text for the daily challenge.
 *
 * Format:
 * ```
 * 🎮 Game Guesser Daily #42
 * Score: 7/10 💪
 * 🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩
 * 🔥 5-day streak
 * ```
 *
 * The emoji grid has one square per placement: 🟩 for correct, 🟥 for incorrect.
 * The extra-try indicator is 💪 for a clean run or ❤️ when the extra try was used.
 * The streak line is omitted for guests and authenticated users with no streak.
 */
export function generateDailyShareText(params: DailyShareParams): string {
  const { challengeNumber, score, totalCards, extraTryUsed, placements, streak } = params;

  const indicator = extraTryUsed ? "❤️" : "💪";
  const emojiGrid = placements.map((p) => (p.correct ? "🟩" : "🟥")).join("");

  const lines: string[] = [
    `🎮 Game Guesser Daily #${String(challengeNumber)}`,
    `Score: ${String(score)}/${String(totalCards)} ${indicator}`,
    emojiGrid,
  ];

  if (streak !== null && streak.current_streak >= 1) {
    lines.push(`🔥 ${String(streak.current_streak)}-day streak`);
  }

  return lines.join("\n");
}
