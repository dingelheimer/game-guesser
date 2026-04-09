import { describe, expect, it } from "vitest";
import {
  computePopularityScore,
  DIFFICULTY_THRESHOLDS,
  rankToTier,
} from "./difficulty";

describe("DIFFICULTY_THRESHOLDS", () => {
  it("easy is top 10", () => {
    expect(DIFFICULTY_THRESHOLDS.easy).toBe(10);
  });

  it("medium is top 20", () => {
    expect(DIFFICULTY_THRESHOLDS.medium).toBe(20);
  });

  it("hard is top 50", () => {
    expect(DIFFICULTY_THRESHOLDS.hard).toBe(50);
  });
});

describe("rankToTier", () => {
  it.each([1, 5, 10])("rank %i → easy", (rank) => {
    expect(rankToTier(rank)).toBe("easy");
  });

  it.each([11, 15, 20])("rank %i → medium", (rank) => {
    expect(rankToTier(rank)).toBe("medium");
  });

  it.each([21, 35, 50])("rank %i → hard", (rank) => {
    expect(rankToTier(rank)).toBe("hard");
  });

  it.each([51, 100, 1000])("rank %i → extreme", (rank) => {
    expect(rankToTier(rank)).toBe("extreme");
  });

  it("null rank → extreme", () => {
    expect(rankToTier(null)).toBe("extreme");
  });

  it("undefined rank → extreme", () => {
    expect(rankToTier(undefined)).toBe("extreme");
  });

  it("boundary: rank 10 is easy, rank 11 is medium", () => {
    expect(rankToTier(10)).toBe("easy");
    expect(rankToTier(11)).toBe("medium");
  });

  it("boundary: rank 20 is medium, rank 21 is hard", () => {
    expect(rankToTier(20)).toBe("medium");
    expect(rankToTier(21)).toBe("hard");
  });

  it("boundary: rank 50 is hard, rank 51 is extreme", () => {
    expect(rankToTier(50)).toBe("hard");
    expect(rankToTier(51)).toBe("extreme");
  });
});

describe("computePopularityScore", () => {
  it("applies weights: rating_count × 1.0, follows × 0.5, hypes × 0.2", () => {
    expect(computePopularityScore(100, 50, 10)).toBe(
      100 * 1.0 + 50 * 0.5 + 10 * 0.2,
    );
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
