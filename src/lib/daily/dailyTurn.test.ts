/**
 * Tests for the pure logic in the daily-turn Edge Function.
 *
 * Covers processDailyTurn, getCurrentCardDeckIndex, and TOTAL_PLACEMENT_CARDS.
 * No I/O — these are plain TypeScript functions.
 */

import { describe, expect, it } from "vitest";

import {
  getCurrentCardDeckIndex,
  processDailyTurn,
  TOTAL_PLACEMENT_CARDS,
} from "../../../supabase/functions/daily-turn/logic/turn";
import type { DailyTurnSnapshot } from "../../../supabase/functions/daily-turn/logic/turn";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTimeline = (years: number[]) =>
  years.map((release_year, i) => ({ game_id: i + 1, release_year }));

const baseSnapshot = (overrides?: Partial<DailyTurnSnapshot>): DailyTurnSnapshot => ({
  score: 0,
  turns_played: 0,
  extra_try_used: false,
  timeline: makeTimeline([1990, 2000]),
  placements: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// TOTAL_PLACEMENT_CARDS
// ---------------------------------------------------------------------------

describe("TOTAL_PLACEMENT_CARDS", () => {
  it("is 10", () => {
    expect(TOTAL_PLACEMENT_CARDS).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// getCurrentCardDeckIndex
// ---------------------------------------------------------------------------

describe("getCurrentCardDeckIndex", () => {
  it("returns 1 when turns_played is 0 (first placement card)", () => {
    expect(getCurrentCardDeckIndex(0)).toBe(1);
  });

  it("returns 2 when turns_played is 1", () => {
    expect(getCurrentCardDeckIndex(1)).toBe(2);
  });

  it("returns 10 when turns_played is 9 (last placement card)", () => {
    expect(getCurrentCardDeckIndex(9)).toBe(10);
  });

  it("never returns 0 (deck[0] is the anchor, not a placement card)", () => {
    for (let t = 0; t < TOTAL_PLACEMENT_CARDS; t++) {
      expect(getCurrentCardDeckIndex(t)).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// processDailyTurn — correct placement
// ---------------------------------------------------------------------------

describe("processDailyTurn — correct placement", () => {
  it("increments score and turns_played", () => {
    // timeline: [1990, 2000]; placing 1995 at position 1 (between them)
    const result = processDailyTurn(baseSnapshot(), 99, 1995, 1);

    expect(result.correct).toBe(true);
    expect(result.new_score).toBe(1);
    expect(result.new_turns_played).toBe(1);
  });

  it("inserts card into timeline at the correct position", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1995, 1);

    expect(result.new_timeline).toEqual([
      { game_id: 1, release_year: 1990 },
      { game_id: 99, release_year: 1995 },
      { game_id: 2, release_year: 2000 },
    ]);
  });

  it("does not consume extra try on a correct placement", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1995, 1);

    expect(result.new_extra_try_used).toBe(false);
  });

  it("game_over is false when fewer than 10 turns have been played", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1995, 1);

    expect(result.game_over).toBe(false);
  });

  it("game_over is true when the 10th correct placement is made", () => {
    // turns_played = 9 → this is the 10th turn
    const result = processDailyTurn(baseSnapshot({ turns_played: 9 }), 99, 1995, 1);

    expect(result.correct).toBe(true);
    expect(result.game_over).toBe(true);
    expect(result.new_turns_played).toBe(10);
  });

  it("appends a correct placement record", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1995, 1);

    expect(result.new_placements).toEqual([{ game_id: 99, position: 1, correct: true }]);
  });

  it("does not include valid_positions on a correct placement", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1995, 1);

    expect(result.valid_positions).toBeUndefined();
  });

  it("preserves existing extra_try_used state when it was already true", () => {
    const result = processDailyTurn(baseSnapshot({ extra_try_used: true }), 99, 1995, 1);

    expect(result.new_extra_try_used).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// processDailyTurn — first wrong placement (extra try available)
// ---------------------------------------------------------------------------

describe("processDailyTurn — first wrong placement (extra try available)", () => {
  it("does not increment score", () => {
    // timeline: [1990, 2000]; placing 1985 at position 2 (after 2000) is wrong
    const result = processDailyTurn(baseSnapshot({ score: 3 }), 99, 1985, 2);

    expect(result.correct).toBe(false);
    expect(result.new_score).toBe(3);
  });

  it("increments turns_played", () => {
    const result = processDailyTurn(baseSnapshot({ turns_played: 2 }), 99, 1985, 2);

    expect(result.new_turns_played).toBe(3);
  });

  it("sets extra_try_used to true", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1985, 2);

    expect(result.new_extra_try_used).toBe(true);
  });

  it("game_over is false (game continues)", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1985, 2);

    expect(result.game_over).toBe(false);
  });

  it("does not modify the timeline", () => {
    const snapshot = baseSnapshot();
    const result = processDailyTurn(snapshot, 99, 1985, 2);

    expect(result.new_timeline).toEqual(snapshot.timeline);
  });

  it("appends a placement record with extra_try: true and valid_positions", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1985, 2);

    expect(result.new_placements).toHaveLength(1);
    expect(result.new_placements[0]).toMatchObject({
      game_id: 99,
      position: 2,
      correct: false,
      extra_try: true,
    });
    expect(result.new_placements[0]?.valid_positions).toBeDefined();
  });

  it("returns valid_positions in the result", () => {
    const result = processDailyTurn(baseSnapshot(), 99, 1985, 2);

    expect(result.valid_positions).toBeDefined();
    expect(Array.isArray(result.valid_positions)).toBe(true);
    // 1985 belongs before 1990, so position 0 is valid
    expect(result.valid_positions).toContain(0);
  });
});

// ---------------------------------------------------------------------------
// processDailyTurn — second wrong placement (extra try already used → game over)
// ---------------------------------------------------------------------------

describe("processDailyTurn — second wrong placement (no extra try left)", () => {
  const snapshotWithExtraTryUsed = (): DailyTurnSnapshot =>
    baseSnapshot({ extra_try_used: true, score: 2, turns_played: 3 });

  it("game_over is true", () => {
    const result = processDailyTurn(snapshotWithExtraTryUsed(), 99, 1985, 2);

    expect(result.correct).toBe(false);
    expect(result.game_over).toBe(true);
  });

  it("does not increment score", () => {
    const result = processDailyTurn(snapshotWithExtraTryUsed(), 99, 1985, 2);

    expect(result.new_score).toBe(2);
  });

  it("increments turns_played", () => {
    const result = processDailyTurn(snapshotWithExtraTryUsed(), 99, 1985, 2);

    expect(result.new_turns_played).toBe(4);
  });

  it("extra_try_used remains true", () => {
    const result = processDailyTurn(snapshotWithExtraTryUsed(), 99, 1985, 2);

    expect(result.new_extra_try_used).toBe(true);
  });

  it("does not modify the timeline", () => {
    const snapshot = snapshotWithExtraTryUsed();
    const result = processDailyTurn(snapshot, 99, 1985, 2);

    expect(result.new_timeline).toEqual(snapshot.timeline);
  });

  it("appends a placement record without extra_try flag", () => {
    const result = processDailyTurn(snapshotWithExtraTryUsed(), 99, 1985, 2);

    expect(result.new_placements).toHaveLength(1);
    expect(result.new_placements[0]).toMatchObject({
      game_id: 99,
      position: 2,
      correct: false,
    });
    expect(result.new_placements[0]?.extra_try).toBeUndefined();
  });

  it("returns valid_positions in the result", () => {
    const result = processDailyTurn(snapshotWithExtraTryUsed(), 99, 1985, 2);

    expect(result.valid_positions).toBeDefined();
    expect(result.valid_positions).toContain(0);
  });
});

// ---------------------------------------------------------------------------
// processDailyTurn — edge cases
// ---------------------------------------------------------------------------

describe("processDailyTurn — edge cases", () => {
  it("valid placement before all cards (position 0)", () => {
    // 1985 placed before [1990, 2000] at position 0 is correct
    const result = processDailyTurn(baseSnapshot(), 99, 1985, 0);

    expect(result.correct).toBe(true);
    expect(result.new_timeline[0]).toEqual({ game_id: 99, release_year: 1985 });
  });

  it("valid placement after all cards (position = timeline.length)", () => {
    // 2005 placed after [1990, 2000] at position 2 is correct
    const result = processDailyTurn(baseSnapshot(), 99, 2005, 2);

    expect(result.correct).toBe(true);
    expect(result.new_timeline[2]).toEqual({ game_id: 99, release_year: 2005 });
  });

  it("preserves prior placements in the history", () => {
    const existing = [{ game_id: 10, position: 0, correct: true }];
    const result = processDailyTurn(baseSnapshot({ placements: existing }), 99, 1995, 1);

    expect(result.new_placements).toHaveLength(2);
    expect(result.new_placements[0]).toEqual(existing[0]);
  });

  it("placement at out-of-range position is treated as incorrect", () => {
    // Position 5 is out of range for a 2-card timeline
    const result = processDailyTurn(baseSnapshot(), 99, 1995, 5);

    expect(result.correct).toBe(false);
  });
});
