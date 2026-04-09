import { describe, expect, it } from "vitest";
import {
  findValidPositions,
  isValidPlacement,
} from "../../../supabase/functions/solo-turn/logic/validate";
import type { TimelineEntry } from "../../../supabase/functions/solo-turn/logic/validate";

// Helpers
const entry = (game_id: number, release_year: number): TimelineEntry => ({
  game_id,
  release_year,
});

// ---------------------------------------------------------------------------
// isValidPlacement — empty timeline
// ---------------------------------------------------------------------------

describe("isValidPlacement — empty timeline", () => {
  it("any year at position 0 is valid", () => {
    expect(isValidPlacement([], 1990, 0)).toBe(true);
    expect(isValidPlacement([], 2000, 0)).toBe(true);
  });

  it("position 1 is out of range", () => {
    expect(isValidPlacement([], 1990, 1)).toBe(false);
  });

  it("negative position is invalid", () => {
    expect(isValidPlacement([], 1990, -1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidPlacement — single-card timeline
// ---------------------------------------------------------------------------

describe("isValidPlacement — single-card timeline [2000]", () => {
  const tl = [entry(1, 2000)];

  it("position 0: year <= 2000 is valid", () => {
    expect(isValidPlacement(tl, 1990, 0)).toBe(true);
    expect(isValidPlacement(tl, 2000, 0)).toBe(true); // same year at prev edge
  });

  it("position 0: year > 2000 is invalid", () => {
    expect(isValidPlacement(tl, 2001, 0)).toBe(false);
  });

  it("position 1: year >= 2000 is valid", () => {
    expect(isValidPlacement(tl, 2000, 1)).toBe(true); // same year at next edge
    expect(isValidPlacement(tl, 2010, 1)).toBe(true);
  });

  it("position 1: year < 2000 is invalid", () => {
    expect(isValidPlacement(tl, 1999, 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidPlacement — multi-card timeline
// ---------------------------------------------------------------------------

describe("isValidPlacement — [1990, 2000, 2010]", () => {
  const tl = [entry(1, 1990), entry(2, 2000), entry(3, 2010)];

  it("position 0: year <= 1990 is valid", () => {
    expect(isValidPlacement(tl, 1985, 0)).toBe(true);
    expect(isValidPlacement(tl, 1990, 0)).toBe(true);
  });

  it("position 0: year > 1990 is invalid", () => {
    expect(isValidPlacement(tl, 1991, 0)).toBe(false);
  });

  it("position 1: year between 1990 and 2000 inclusive is valid", () => {
    expect(isValidPlacement(tl, 1990, 1)).toBe(true);
    expect(isValidPlacement(tl, 1995, 1)).toBe(true);
    expect(isValidPlacement(tl, 2000, 1)).toBe(true);
  });

  it("position 1: year outside 1990–2000 is invalid", () => {
    expect(isValidPlacement(tl, 1989, 1)).toBe(false);
    expect(isValidPlacement(tl, 2001, 1)).toBe(false);
  });

  it("position 2: year between 2000 and 2010 inclusive is valid", () => {
    expect(isValidPlacement(tl, 2000, 2)).toBe(true);
    expect(isValidPlacement(tl, 2005, 2)).toBe(true);
    expect(isValidPlacement(tl, 2010, 2)).toBe(true);
  });

  it("position 3: year >= 2010 is valid", () => {
    expect(isValidPlacement(tl, 2010, 3)).toBe(true);
    expect(isValidPlacement(tl, 2020, 3)).toBe(true);
  });

  it("out-of-range position is invalid", () => {
    expect(isValidPlacement(tl, 2000, 4)).toBe(false);
    expect(isValidPlacement(tl, 2000, -1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidPlacement — same-year adjacency
// ---------------------------------------------------------------------------

describe("isValidPlacement — same-year adjacency", () => {
  it("placing same year as neighbour is always correct", () => {
    const tl = [entry(1, 2005), entry(2, 2010)];
    // Placing a 2005 card — valid at position 0 and 1 (adjacent to the 2005 card)
    expect(isValidPlacement(tl, 2005, 0)).toBe(true);
    expect(isValidPlacement(tl, 2005, 1)).toBe(true);
  });

  it("all-same-year timeline: any position is valid", () => {
    const tl = [entry(1, 2005), entry(2, 2005), entry(3, 2005)];
    for (let i = 0; i <= tl.length; i++) {
      expect(isValidPlacement(tl, 2005, i)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// findValidPositions
// ---------------------------------------------------------------------------

describe("findValidPositions", () => {
  it("returns [0] for empty timeline (any year)", () => {
    expect(findValidPositions([], 2000)).toEqual([0]);
  });

  it("returns all positions where placement is valid", () => {
    const tl = [entry(1, 1990), entry(2, 2000), entry(3, 2010)];
    // Year 1995 fits only at position 1 (between 1990 and 2000)
    expect(findValidPositions(tl, 1995)).toEqual([1]);
  });

  it("year on boundary is valid at both adjacent positions", () => {
    const tl = [entry(1, 1990), entry(2, 2000), entry(3, 2010)];
    // 2000 is on the boundary between positions 1 and 2
    const valid = findValidPositions(tl, 2000);
    expect(valid).toContain(1);
    expect(valid).toContain(2);
  });

  it("returns at least one position for any year", () => {
    const tl = [entry(1, 1990), entry(2, 2000)];
    // Every year has at least one valid position
    for (const year of [1980, 1990, 1995, 2000, 2010]) {
      expect(findValidPositions(tl, year).length).toBeGreaterThan(0);
    }
  });

  it("year before the entire timeline has only position 0", () => {
    const tl = [entry(1, 2000), entry(2, 2010)];
    expect(findValidPositions(tl, 1990)).toEqual([0]);
  });

  it("year after the entire timeline has only the last position", () => {
    const tl = [entry(1, 2000), entry(2, 2010)];
    expect(findValidPositions(tl, 2020)).toEqual([2]);
  });
});
