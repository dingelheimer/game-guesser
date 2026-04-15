// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { getNextTurnIndex, insertTimelineEntry, isPlacementCorrect } from "./turns";

describe("isPlacementCorrect", () => {
  const timeline = [
    { gameId: 1, name: "Doom", releaseYear: 1993 },
    { gameId: 2, name: "Halo", releaseYear: 2001 },
    { gameId: 3, name: "Portal", releaseYear: 2007 },
  ] as const;

  it("accepts years that preserve chronological order", () => {
    expect(isPlacementCorrect(timeline, 1998, 1)).toBe(true);
    expect(isPlacementCorrect(timeline, 2001, 1)).toBe(true);
    expect(isPlacementCorrect(timeline, 1988, 0)).toBe(true);
    expect(isPlacementCorrect(timeline, 2010, 3)).toBe(true);
  });

  it("rejects out-of-order placements", () => {
    expect(isPlacementCorrect(timeline, 2010, 0)).toBe(false);
    expect(isPlacementCorrect(timeline, 1988, 2)).toBe(false);
  });
});

describe("insertTimelineEntry", () => {
  it("inserts a card at the requested position", () => {
    const result = insertTimelineEntry(
      [{ gameId: 1, name: "Doom", releaseYear: 1993 }],
      { gameId: 2, name: "Halo", releaseYear: 2001 },
      1,
    );

    expect(result).toEqual([
      { gameId: 1, name: "Doom", releaseYear: 1993 },
      { gameId: 2, name: "Halo", releaseYear: 2001 },
    ]);
  });
});

describe("getNextTurnIndex", () => {
  it("advances round-robin through the turn order", () => {
    expect(getNextTurnIndex(["a", "b", "c"], "a")).toBe(1);
    expect(getNextTurnIndex(["a", "b", "c"], "c")).toBe(0);
  });

  it("returns null when the active player is missing", () => {
    expect(getNextTurnIndex(["a", "b"], "z")).toBeNull();
  });
});
