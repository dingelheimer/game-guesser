// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  applyDrawTimeSwap,
  processHigherLowerTurn,
  processTurn,
} from "../../../supabase/functions/solo-turn/logic/turn";
import type { SessionSnapshot } from "../../../supabase/functions/solo-turn/logic/turn";
import type { TimelineEntry } from "../../../supabase/functions/solo-turn/logic/validate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const entry = (game_id: number, release_year: number): TimelineEntry => ({
  game_id,
  release_year,
});

const baseSession = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  score: 0,
  turns_played: 0,
  current_streak: 0,
  best_streak: 0,
  deck: [10, 20, 30],
  timeline: [entry(1, 1990)], // anchor: 1990
  ...overrides,
});

// ---------------------------------------------------------------------------
// processTurn — invalid input
// ---------------------------------------------------------------------------

describe("processTurn — invalid input", () => {
  it("throws when deck is empty", () => {
    expect(() => processTurn(baseSession({ deck: [] }), 1990, 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// processTurn — incorrect placement
// ---------------------------------------------------------------------------

describe("processTurn — incorrect placement", () => {
  it("returns correct: false and game_over: true", () => {
    const session = baseSession();
    // Timeline is [1990]. Placing a 2000 card at position 0 (before 1990) is wrong.
    const result = processTurn(session, 2000, 0);
    expect(result.correct).toBe(false);
    expect(result.game_over).toBe(true);
  });

  it("does not change score or timeline", () => {
    const session = baseSession({ score: 3 });
    const result = processTurn(session, 2000, 0);
    expect(result.new_score).toBe(3);
    expect(result.new_timeline).toEqual(session.timeline);
  });

  it("does not change the deck", () => {
    const session = baseSession();
    const result = processTurn(session, 2000, 0);
    expect(result.new_deck).toEqual(session.deck);
  });

  it("resets current_streak to 0", () => {
    const session = baseSession({ current_streak: 5, best_streak: 5 });
    const result = processTurn(session, 2000, 0);
    expect(result.new_current_streak).toBe(0);
  });

  it("preserves best_streak on incorrect", () => {
    const session = baseSession({ current_streak: 5, best_streak: 5 });
    const result = processTurn(session, 2000, 0);
    expect(result.new_best_streak).toBe(5);
  });

  it("increments turns_played", () => {
    const result = processTurn(baseSession({ turns_played: 2 }), 2000, 0);
    expect(result.new_turns_played).toBe(3);
  });

  it("includes valid_positions showing where it could have been placed", () => {
    const session = baseSession();
    // 2000 card on timeline [1990]: valid at position 1 (after 1990)
    const result = processTurn(session, 2000, 0);
    expect(result.valid_positions).toBeDefined();
    expect(result.valid_positions).toContain(1);
  });
});

// ---------------------------------------------------------------------------
// processTurn — correct placement
// ---------------------------------------------------------------------------

describe("processTurn — correct placement", () => {
  it("returns correct: true", () => {
    const session = baseSession();
    // Timeline [1990], placing 2000 card at position 1 (after 1990)
    const result = processTurn(session, 2000, 1);
    expect(result.correct).toBe(true);
  });

  it("inserts the card into the timeline at the given position", () => {
    const session = baseSession();
    const result = processTurn(session, 2000, 1);
    expect(result.new_timeline).toHaveLength(2);
    expect(result.new_timeline[1]).toEqual({ game_id: 10, release_year: 2000 });
  });

  it("inserts at position 0 (before anchor)", () => {
    const session = baseSession();
    // Placing a 1980 card before the 1990 anchor
    const result = processTurn(session, 1980, 0);
    expect(result.correct).toBe(true);
    expect(result.new_timeline[0]).toEqual({ game_id: 10, release_year: 1980 });
    expect(result.new_timeline[1]).toEqual(entry(1, 1990));
  });

  it("increments score", () => {
    const result = processTurn(baseSession({ score: 4 }), 2000, 1);
    expect(result.new_score).toBe(5);
  });

  it("increments turns_played", () => {
    const result = processTurn(baseSession({ turns_played: 3 }), 2000, 1);
    expect(result.new_turns_played).toBe(4);
  });

  it("increments current_streak", () => {
    const result = processTurn(baseSession({ current_streak: 2 }), 2000, 1);
    expect(result.new_current_streak).toBe(3);
  });

  it("updates best_streak when current streak exceeds it", () => {
    const result = processTurn(baseSession({ current_streak: 5, best_streak: 5 }), 2000, 1);
    expect(result.new_best_streak).toBe(6);
  });

  it("keeps best_streak when current streak does not exceed it", () => {
    const result = processTurn(baseSession({ current_streak: 2, best_streak: 10 }), 2000, 1);
    expect(result.new_best_streak).toBe(10);
  });

  it("advances the deck (removes deck[0])", () => {
    const session = baseSession({ deck: [10, 20, 30] });
    const result = processTurn(session, 2000, 1);
    expect(result.new_deck).toEqual([20, 30]);
  });

  it("does NOT include valid_positions on correct placement", () => {
    const result = processTurn(baseSession(), 2000, 1);
    expect(result.valid_positions).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// processTurn — deck exhausted
// ---------------------------------------------------------------------------

describe("processTurn — deck exhausted after correct placement", () => {
  it("sets game_over: true when deck becomes empty", () => {
    const session = baseSession({ deck: [10] });
    const result = processTurn(session, 2000, 1);
    expect(result.correct).toBe(true);
    expect(result.game_over).toBe(true);
    expect(result.new_deck).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// processTurn — same-year adjacency
// ---------------------------------------------------------------------------

describe("processTurn — same-year adjacency", () => {
  it("placing same year as adjacent card is correct", () => {
    // Timeline: [1990, 2010]. Placing a 1990 card at position 1 (between 1990 and 2010).
    const session = baseSession({
      timeline: [entry(1, 1990), entry(2, 2010)],
    });
    const result = processTurn(session, 1990, 1);
    expect(result.correct).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// processTurn — multi-card timeline insertion order
// ---------------------------------------------------------------------------

describe("processTurn — insertion into multi-card timeline", () => {
  it("inserts in the middle maintaining chronological order", () => {
    const session = baseSession({
      deck: [10, 20],
      timeline: [entry(1, 1980), entry(2, 2000), entry(3, 2020)],
    });
    // Placing a 1990 card at position 1 (between 1980 and 2000)
    const result = processTurn(session, 1990, 1);
    expect(result.correct).toBe(true);
    expect(result.new_timeline).toHaveLength(4);
    const years = result.new_timeline.map((e) => e.release_year);
    expect(years).toEqual([1980, 1990, 2000, 2020]);
  });
});

// ---------------------------------------------------------------------------
// processHigherLowerTurn
// ---------------------------------------------------------------------------

const hlEntry = (game_id: number, release_year: number): TimelineEntry => ({
  game_id,
  release_year,
});

const hlSession = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  score: 0,
  turns_played: 0,
  current_streak: 0,
  best_streak: 0,
  deck: [10, 20, 30],
  timeline: [hlEntry(1, 2010)], // reference card: 2010
  ...overrides,
});

describe("processHigherLowerTurn — invalid input", () => {
  it("throws when deck is empty", () => {
    expect(() => processHigherLowerTurn(hlSession({ deck: [] }), 2010, 2015, "higher")).toThrow();
  });
});

describe("processHigherLowerTurn — incorrect guess", () => {
  it("returns correct: false and game_over: true", () => {
    // Reference 2010, card 2005, guessing "higher" (wrong)
    const result = processHigherLowerTurn(hlSession(), 2010, 2005, "higher");
    expect(result.correct).toBe(false);
    expect(result.game_over).toBe(true);
  });

  it("does not change score", () => {
    const result = processHigherLowerTurn(hlSession({ score: 3 }), 2010, 2005, "higher");
    expect(result.new_score).toBe(3);
  });

  it("resets current_streak", () => {
    const result = processHigherLowerTurn(
      hlSession({ current_streak: 5, best_streak: 5 }),
      2010,
      2005,
      "higher",
    );
    expect(result.new_current_streak).toBe(0);
  });

  it("preserves best_streak on incorrect", () => {
    const result = processHigherLowerTurn(
      hlSession({ current_streak: 5, best_streak: 5 }),
      2010,
      2005,
      "higher",
    );
    expect(result.new_best_streak).toBe(5);
  });

  it("keeps timeline unchanged", () => {
    const session = hlSession();
    const result = processHigherLowerTurn(session, 2010, 2005, "higher");
    expect(result.new_timeline).toEqual(session.timeline);
  });
});

describe("processHigherLowerTurn — correct guess", () => {
  it("returns correct: true", () => {
    // Reference 2010, card 2015, guessing "higher" (correct)
    const result = processHigherLowerTurn(hlSession(), 2010, 2015, "higher");
    expect(result.correct).toBe(true);
    expect(result.game_over).toBe(false);
  });

  it("new timeline has exactly one entry — the just-guessed card", () => {
    const result = processHigherLowerTurn(hlSession(), 2010, 2015, "higher");
    expect(result.new_timeline).toHaveLength(1);
    expect(result.new_timeline[0]).toEqual({ game_id: 10, release_year: 2015 });
  });

  it("increments score", () => {
    const result = processHigherLowerTurn(hlSession({ score: 4 }), 2010, 2015, "higher");
    expect(result.new_score).toBe(5);
  });

  it("increments current_streak", () => {
    const result = processHigherLowerTurn(hlSession({ current_streak: 2 }), 2010, 2015, "higher");
    expect(result.new_current_streak).toBe(3);
  });

  it("advances the deck", () => {
    const result = processHigherLowerTurn(hlSession(), 2010, 2015, "higher");
    expect(result.new_deck).toEqual([20, 30]);
  });

  it("sets game_over when deck is exhausted", () => {
    const result = processHigherLowerTurn(hlSession({ deck: [10] }), 2010, 2015, "higher");
    expect(result.correct).toBe(true);
    expect(result.game_over).toBe(true);
    expect(result.new_deck).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyDrawTimeSwap
// ---------------------------------------------------------------------------

describe("applyDrawTimeSwap — no swap needed", () => {
  it("returns deck unchanged when front card differs from reference year", () => {
    const deck = [1, 2, 3];
    const years = new Map([
      [1, 2005],
      [2, 2013],
      [3, 2010],
    ]);
    const result = applyDrawTimeSwap(deck, years, 2013);
    expect(result).toEqual([1, 2, 3]);
  });

  it("returns empty array for empty deck", () => {
    expect(applyDrawTimeSwap([], new Map(), 2010)).toEqual([]);
  });
});

describe("applyDrawTimeSwap — swap needed", () => {
  it("swaps the first different-year card to the front", () => {
    // deck[0]=A(2013), deck[1]=B(2013), deck[2]=C(2005) — reference is 2013
    const deck = [10, 11, 12];
    const years = new Map([
      [10, 2013],
      [11, 2013],
      [12, 2005],
    ]);
    const result = applyDrawTimeSwap(deck, years, 2013);
    expect(result).not.toBeNull();
    if (result === null) return; // type narrowing
    expect(result[0]).toBe(12); // C(2005) moved to front
    expect(result).toContain(10);
    expect(result).toContain(11);
  });

  it("does not mutate the original deck array", () => {
    const deck = [10, 11, 12];
    const years = new Map([
      [10, 2013],
      [11, 2005],
      [12, 2013],
    ]);
    const original = [...deck];
    applyDrawTimeSwap(deck, years, 2013);
    expect(deck).toEqual(original);
  });
});

describe("applyDrawTimeSwap — all-same-year win", () => {
  it("returns null when all remaining cards share the reference year", () => {
    const deck = [10, 11, 12];
    const years = new Map([
      [10, 2013],
      [11, 2013],
      [12, 2013],
    ]);
    expect(applyDrawTimeSwap(deck, years, 2013)).toBeNull();
  });
});
