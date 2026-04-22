// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { generateDailyShareText } from "./share";
import type { DailyShareParams } from "./share";

const BASE_PLACEMENTS = [
  { game_id: 1, position: 0, correct: true },
  { game_id: 2, position: 1, correct: true },
  { game_id: 3, position: 2, correct: false },
  { game_id: 4, position: 3, correct: true },
  { game_id: 5, position: 4, correct: true },
  { game_id: 6, position: 5, correct: true },
  { game_id: 7, position: 6, correct: true },
  { game_id: 8, position: 7, correct: true },
  { game_id: 9, position: 8, correct: true },
  { game_id: 10, position: 9, correct: true },
];

function makeParams(overrides: Partial<DailyShareParams> = {}): DailyShareParams {
  return {
    challengeNumber: 42,
    score: 9,
    totalCards: 10,
    extraTryUsed: false,
    placements: BASE_PLACEMENTS,
    streak: null,
    ...overrides,
  };
}

describe("generateDailyShareText", () => {
  it("includes the challenge number in the header", () => {
    const text = generateDailyShareText(makeParams({ challengeNumber: 99 }));
    expect(text).toContain("🎮 Game Guesser Daily #99");
  });

  it("includes score and total cards", () => {
    const text = generateDailyShareText(makeParams({ score: 7, totalCards: 10 }));
    expect(text).toContain("Score: 7/10");
  });

  it("uses 💪 indicator for clean run (extra try not used)", () => {
    const text = generateDailyShareText(makeParams({ extraTryUsed: false }));
    expect(text).toContain("💪");
    expect(text).not.toContain("❤️");
  });

  it("uses ❤️ indicator when extra try was used", () => {
    const text = generateDailyShareText(makeParams({ extraTryUsed: true }));
    expect(text).toContain("❤️");
    expect(text).not.toContain("💪");
  });

  it("produces an emoji grid with 🟩 for correct and 🟥 for incorrect placements", () => {
    const text = generateDailyShareText(makeParams());
    // BASE_PLACEMENTS has 9 correct and 1 incorrect (index 2)
    expect(text).toContain("🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩");
  });

  it("produces an all-correct emoji grid", () => {
    const allCorrect = BASE_PLACEMENTS.map((p) => ({ ...p, correct: true }));
    const text = generateDailyShareText(makeParams({ placements: allCorrect, score: 10 }));
    expect(text).toContain("🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩");
  });

  it("produces an all-incorrect emoji grid", () => {
    const allWrong = BASE_PLACEMENTS.map((p) => ({ ...p, correct: false }));
    const text = generateDailyShareText(makeParams({ placements: allWrong, score: 0 }));
    expect(text).toContain("🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥");
  });

  it("omits the streak line for guest users (streak = null)", () => {
    const text = generateDailyShareText(makeParams({ streak: null }));
    expect(text).not.toContain("streak");
    expect(text).not.toContain("🔥");
  });

  it("omits the streak line when current_streak is 0", () => {
    const text = generateDailyShareText(
      makeParams({ streak: { current_streak: 0, best_streak: 5 } }),
    );
    expect(text).not.toContain("🔥");
  });

  it("includes the streak line for authenticated users with streak ≥ 1", () => {
    const text = generateDailyShareText(
      makeParams({ streak: { current_streak: 5, best_streak: 10 } }),
    );
    expect(text).toContain("🔥 5-day streak");
  });

  it("includes the streak line even when streak equals 1", () => {
    const text = generateDailyShareText(
      makeParams({ streak: { current_streak: 1, best_streak: 1 } }),
    );
    expect(text).toContain("🔥 1-day streak");
  });

  it("omits the play URL", () => {
    const text = generateDailyShareText(makeParams());
    expect(text).not.toContain("Play →");
  });

  it("does not have a trailing blank line", () => {
    const text = generateDailyShareText(makeParams());
    expect(text).not.toMatch(/\n\n$/);
  });

  it("produces the full expected share text without streak", () => {
    const placements = [
      { game_id: 1, position: 0, correct: true },
      { game_id: 2, position: 1, correct: true },
      { game_id: 3, position: 2, correct: true },
      { game_id: 4, position: 3, correct: false },
      { game_id: 5, position: 4, correct: true },
      { game_id: 6, position: 5, correct: true },
      { game_id: 7, position: 6, correct: true },
      { game_id: 8, position: 7, correct: true },
      { game_id: 9, position: 8, correct: true },
      { game_id: 10, position: 9, correct: true },
    ];
    const text = generateDailyShareText({
      challengeNumber: 42,
      score: 9,
      totalCards: 10,
      extraTryUsed: false,
      placements,
      streak: null,
    });
    expect(text).toBe(
      "🎮 Game Guesser Daily #42\nScore: 9/10 💪\n🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩",
    );
  });

  it("produces the full expected share text with streak and extra try used", () => {
    const placements = [
      { game_id: 1, position: 0, correct: true },
      { game_id: 2, position: 1, correct: true },
      { game_id: 3, position: 2, correct: true },
      { game_id: 4, position: 3, correct: true },
      { game_id: 5, position: 4, correct: false },
      { game_id: 6, position: 5, correct: true },
      { game_id: 7, position: 6, correct: true },
      { game_id: 8, position: 7, correct: true },
      { game_id: 9, position: 8, correct: true },
      { game_id: 10, position: 9, correct: true },
    ];
    const text = generateDailyShareText({
      challengeNumber: 7,
      score: 9,
      totalCards: 10,
      extraTryUsed: true,
      placements,
      streak: { current_streak: 3, best_streak: 5 },
    });
    expect(text).toBe(
      "🎮 Game Guesser Daily #7\nScore: 9/10 ❤️\n🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩\n🔥 3-day streak",
    );
  });
});
