// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { computePopularityScore, DIFFICULTY_THRESHOLDS, rankToTier } from "./difficulty";

describe("DIFFICULTY_THRESHOLDS", () => {
  it("easy is top 2", () => {
    expect(DIFFICULTY_THRESHOLDS.easy).toBe(2);
  });

  it("medium is top 5", () => {
    expect(DIFFICULTY_THRESHOLDS.medium).toBe(5);
  });

  it("hard is top 10", () => {
    expect(DIFFICULTY_THRESHOLDS.hard).toBe(10);
  });

  it("extreme is top 50", () => {
    expect(DIFFICULTY_THRESHOLDS.extreme).toBe(50);
  });

  it("god_gamer is top 100", () => {
    expect(DIFFICULTY_THRESHOLDS.god_gamer).toBe(100);
  });
});

describe("rankToTier", () => {
  it.each([1, 2])("rank %i → easy", (rank) => {
    expect(rankToTier(rank)).toBe("easy");
  });

  it.each([3, 4, 5])("rank %i → medium", (rank) => {
    expect(rankToTier(rank)).toBe("medium");
  });

  it.each([6, 8, 10])("rank %i → hard", (rank) => {
    expect(rankToTier(rank)).toBe("hard");
  });

  it.each([11, 30, 50])("rank %i → extreme", (rank) => {
    expect(rankToTier(rank)).toBe("extreme");
  });

  it.each([51, 75, 100])("rank %i → god_gamer", (rank) => {
    expect(rankToTier(rank)).toBe("god_gamer");
  });

  it.each([101, 500, 1000])("rank %i → god_gamer (beyond cap)", (rank) => {
    expect(rankToTier(rank)).toBe("god_gamer");
  });

  it("null rank → god_gamer", () => {
    expect(rankToTier(null)).toBe("god_gamer");
  });

  it("undefined rank → god_gamer", () => {
    expect(rankToTier(undefined)).toBe("god_gamer");
  });

  it("boundary: rank 2 is easy, rank 3 is medium", () => {
    expect(rankToTier(2)).toBe("easy");
    expect(rankToTier(3)).toBe("medium");
  });

  it("boundary: rank 5 is medium, rank 6 is hard", () => {
    expect(rankToTier(5)).toBe("medium");
    expect(rankToTier(6)).toBe("hard");
  });

  it("boundary: rank 10 is hard, rank 11 is extreme", () => {
    expect(rankToTier(10)).toBe("hard");
    expect(rankToTier(11)).toBe("extreme");
  });

  it("boundary: rank 50 is extreme, rank 51 is god_gamer", () => {
    expect(rankToTier(50)).toBe("extreme");
    expect(rankToTier(51)).toBe("god_gamer");
  });
});

describe("computePopularityScore", () => {
  it("applies weights: rating_count × 1.0, follows × 0.5, hypes × 0.2", () => {
    expect(computePopularityScore(100, 50, 10)).toBe(100 * 1.0 + 50 * 0.5 + 10 * 0.2);
  });

  it("returns 0 for all-zero inputs", () => {
    expect(computePopularityScore(0, 0, 0)).toBe(0);
  });

  it("rating_count alone contributes its full value", () => {
    expect(computePopularityScore(500, 0, 0)).toBe(500);
  });

  it("follows alone contributes half its value", () => {
    expect(computePopularityScore(0, 200, 0)).toBe(100);
  });

  it("hypes alone contributes one-fifth of its value", () => {
    expect(computePopularityScore(0, 0, 100)).toBe(20);
  });

  it("rating_count dominates over follows at the same absolute value", () => {
    const scoreRating = computePopularityScore(1000, 0, 0);
    const scoreFollows = computePopularityScore(0, 1000, 0);
    expect(scoreRating).toBeGreaterThan(scoreFollows);
  });

  it("large inputs do not overflow", () => {
    const score = computePopularityScore(1_000_000, 500_000, 100_000);
    expect(score).toBe(1_000_000 * 1.0 + 500_000 * 0.5 + 100_000 * 0.2);
  });
});
