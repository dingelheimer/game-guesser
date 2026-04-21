/**
 * Tests for the pure logic in the daily-start Edge Function.
 *
 * Covers getCurrentCardDeckIndex, isInProgress, and constants.
 * No I/O — these are plain TypeScript functions.
 */

import { describe, expect, it } from "vitest";

import {
  DECK_SIZE,
  getCurrentCardDeckIndex,
  isInProgress,
  TOTAL_PLACEMENT_CARDS,
} from "../../../supabase/functions/daily-start/logic/start";

describe("constants", () => {
  it("TOTAL_PLACEMENT_CARDS is 10", () => {
    expect(TOTAL_PLACEMENT_CARDS).toBe(10);
  });

  it("DECK_SIZE is 11", () => {
    expect(DECK_SIZE).toBe(11);
  });
});

describe("getCurrentCardDeckIndex", () => {
  it("returns 1 when turns_played is 0 (first card to place)", () => {
    expect(getCurrentCardDeckIndex(0)).toBe(1);
  });

  it("returns 2 when turns_played is 1", () => {
    expect(getCurrentCardDeckIndex(1)).toBe(2);
  });

  it("returns 10 when turns_played is 9 (last card to place)", () => {
    expect(getCurrentCardDeckIndex(9)).toBe(10);
  });

  it("deck[0] is the anchor — index 0 is never returned for a valid game", () => {
    // The first placement card is always at index 1
    for (let t = 0; t < TOTAL_PLACEMENT_CARDS; t++) {
      expect(getCurrentCardDeckIndex(t)).toBeGreaterThan(0);
    }
  });

  it("all indices are within [1, DECK_SIZE - 1]", () => {
    for (let t = 0; t < TOTAL_PLACEMENT_CARDS; t++) {
      const idx = getCurrentCardDeckIndex(t);
      expect(idx).toBeGreaterThanOrEqual(1);
      expect(idx).toBeLessThanOrEqual(DECK_SIZE - 1);
    }
  });
});

describe("isInProgress", () => {
  it("returns true when not completed and turns_played is 0", () => {
    expect(isInProgress(0, false)).toBe(true);
  });

  it("returns true when not completed and turns_played is 5", () => {
    expect(isInProgress(5, false)).toBe(true);
  });

  it("returns true when not completed and turns_played is 9 (last turn)", () => {
    expect(isInProgress(9, false)).toBe(true);
  });

  it("returns false when completed is true (regardless of turns_played)", () => {
    expect(isInProgress(0, true)).toBe(false);
    expect(isInProgress(5, true)).toBe(false);
    expect(isInProgress(10, true)).toBe(false);
  });

  it("returns false when turns_played equals TOTAL_PLACEMENT_CARDS", () => {
    expect(isInProgress(TOTAL_PLACEMENT_CARDS, false)).toBe(false);
  });

  it("returns false when turns_played is negative", () => {
    expect(isInProgress(-1, false)).toBe(false);
  });
});
