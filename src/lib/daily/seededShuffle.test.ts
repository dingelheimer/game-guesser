/**
 * Tests for the seeded-shuffle utility used by daily challenge generation.
 *
 * These tests cover the mulberry32 PRNG, seededShuffle, computeChallengeNumber,
 * and utcDateString functions without any I/O.
 */

import { describe, expect, it } from "vitest";

// Import the pure functions directly from the Deno source.
// Since these are plain TypeScript with no Deno-specific APIs, they work in Vitest.
import {
  computeChallengeNumber,
  mulberry32,
  seededShuffle,
  utcDateString,
} from "../../../supabase/functions/_shared/seeded-shuffle";

describe("mulberry32", () => {
  it("produces values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic — same seed produces same sequence", () => {
    const rng1 = mulberry32(99);
    const rng2 = mulberry32(99);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("different seeds produce different sequences", () => {
    const seq1 = Array.from({ length: 10 }, mulberry32(1));
    const seq2 = Array.from({ length: 10 }, mulberry32(2));
    expect(seq1).not.toEqual(seq2);
  });
});

describe("seededShuffle", () => {
  it("returns all original elements (no loss, no duplication)", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = seededShuffle(input, 42);
    expect([...result].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
  });

  it("does not mutate the original array", () => {
    const input = [1, 2, 3, 4, 5];
    const original = [...input];
    seededShuffle(input, 7);
    expect(input).toEqual(original);
  });

  it("is deterministic — same input + seed always returns same order", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const r1 = seededShuffle(input, 123);
    const r2 = seededShuffle(input, 123);
    expect(r1).toEqual(r2);
  });

  it("different seeds produce different orderings (with very high probability)", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const r1 = seededShuffle(input, 1);
    const r2 = seededShuffle(input, 2);
    expect(r1).not.toEqual(r2);
  });

  it("handles an empty array", () => {
    expect(seededShuffle([], 1)).toEqual([]);
  });

  it("handles a single-element array", () => {
    expect(seededShuffle([42], 99)).toEqual([42]);
  });

  it("two different challenge numbers produce different first 11 games", () => {
    const pool = Array.from({ length: 200 }, (_, i) => i + 1);
    const deck1 = seededShuffle(pool, 1).slice(0, 11);
    const deck2 = seededShuffle(pool, 2).slice(0, 11);
    expect(deck1).not.toEqual(deck2);
  });
});

describe("computeChallengeNumber", () => {
  it("returns 1 for the launch date itself", () => {
    expect(computeChallengeNumber("2026-05-01", "2026-05-01")).toBe(1);
  });

  it("returns 2 for the day after launch", () => {
    expect(computeChallengeNumber("2026-05-01", "2026-05-02")).toBe(2);
  });

  it("returns correct number for a date many days later", () => {
    expect(computeChallengeNumber("2026-05-01", "2026-06-15")).toBe(46);
  });

  it("returns 0 for the day before the launch date", () => {
    expect(computeChallengeNumber("2026-05-01", "2026-04-30")).toBe(0);
  });

  it("returns negative values for dates well before the launch date", () => {
    expect(computeChallengeNumber("2026-05-01", "2026-04-21")).toBe(-9);
  });
});

describe("utcDateString", () => {
  it("returns a YYYY-MM-DD string for the given date", () => {
    const d = new Date("2026-05-15T00:00:00.000Z");
    expect(utcDateString(d)).toBe("2026-05-15");
  });

  it("uses UTC date, not local date", () => {
    // 2026-05-15T23:00:00Z — local time might be May 16 in some timezones
    const d = new Date("2026-05-15T23:00:00.000Z");
    expect(utcDateString(d)).toBe("2026-05-15");
  });
});
