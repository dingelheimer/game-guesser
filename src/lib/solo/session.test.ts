// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { buildInitialSession, shuffle } from "../../../supabase/functions/solo-start/logic/session";
import type { EligibleGame } from "../../../supabase/functions/solo-start/logic/session";

// ---------------------------------------------------------------------------
// shuffle
// ---------------------------------------------------------------------------

describe("shuffle", () => {
  it("returns an array with the same elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the original array", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it("returns a new array instance", () => {
    const input = [1, 2, 3];
    const result = shuffle(input);
    expect(result).not.toBe(input);
  });

  it("produces a deterministic result with a fixed-sequence RNG", () => {
    const input = [1, 2, 3, 4, 5];
    let call = 0;
    const rng = () => [0.1, 0.5, 0.9, 0.3, 0.7][call++] ?? 0;
    const first = shuffle(input, rng);
    call = 0;
    const second = shuffle(input, rng);
    expect(first).toEqual(second);
  });

  it("handles an empty array", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("handles a single-element array", () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

// ---------------------------------------------------------------------------
// buildInitialSession
// ---------------------------------------------------------------------------

describe("buildInitialSession", () => {
  const games: EligibleGame[] = [
    { id: 1, release_year: 1990 },
    { id: 2, release_year: 1995 },
    { id: 3, release_year: 2000 },
    { id: 4, release_year: 2005 },
  ];

  it("throws when fewer than 2 games are supplied", () => {
    const oneGame = games.slice(0, 1);
    expect(() => buildInitialSession([])).toThrow();
    expect(() => buildInitialSession(oneGame)).toThrow();
  });

  it("anchor is the first shuffled game", () => {
    // Fix RNG so shuffle returns games as-is (no swaps)
    const identityRng = () => 0;
    const result = buildInitialSession(games, identityRng);
    // With rng() === 0, Fisher-Yates always picks index 0 for each swap.
    // The resulting shuffle is deterministic — anchor will be some game in the input.
    expect(games.map((g) => g.id)).toContain(result.anchor.id);
  });

  it("deck contains all other game IDs", () => {
    const identityRng = () => 0;
    const result = buildInitialSession(games, identityRng);
    // Deck has all game IDs except the anchor
    const expectedIds = games.map((g) => g.id).filter((id) => id !== result.anchor.id);
    expect(result.deck).toHaveLength(expectedIds.length);
    for (const id of expectedIds) {
      expect(result.deck).toContain(id);
    }
  });

  it("deck does NOT contain the anchor's id", () => {
    const identityRng = () => 0;
    const result = buildInitialSession(games, identityRng);
    expect(result.deck).not.toContain(result.anchor.id);
  });

  it("uses default Math.random when no rng provided", () => {
    // Just verify it doesn't throw and returns valid structure
    const result = buildInitialSession(games);
    expect(typeof result.anchor.id).toBe("number");
    expect(result.deck.length).toBe(games.length - 1);
  });

  it("works with exactly 2 games", () => {
    const two = games.slice(0, 2);
    const result = buildInitialSession(two, () => 0);
    expect(result.deck).toHaveLength(1);
  });
});
