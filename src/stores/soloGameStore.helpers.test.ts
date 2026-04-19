// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, expect } from "vitest";
import { revealedToTimelineItem, hiddenToTimelineItem, checkPlatformGuess } from "./soloGameStore";
import type { RevealedCardData, HiddenCardData } from "@/lib/solo/api";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const mockRevealedCard: RevealedCardData = {
  game_id: 1,
  name: "Super Mario Bros",
  release_year: 1985,
  cover_image_id: "cover_abc",
  screenshot_image_ids: ["shot_1", "shot_2"],
  platform_names: ["NES", "Game Boy"],
};

const mockHiddenCard: HiddenCardData = {
  game_id: 2,
  screenshot_image_ids: ["shot_hidden_1"],
};

// ── revealedToTimelineItem ────────────────────────────────────────────────────

describe("revealedToTimelineItem", () => {
  it("maps all fields correctly", () => {
    const item = revealedToTimelineItem(mockRevealedCard);
    expect(item.id).toBe("1");
    expect(item.screenshotImageId).toBe("shot_1");
    expect(item.coverImageId).toBe("cover_abc");
    expect(item.title).toBe("Super Mario Bros");
    expect(item.releaseYear).toBe(1985);
    expect(item.platform).toBe("NES");
    expect(item.isRevealed).toBe(true);
  });

  it("falls back to null screenshot when none provided", () => {
    const card: RevealedCardData = { ...mockRevealedCard, screenshot_image_ids: [] };
    const item = revealedToTimelineItem(card);
    expect(item.screenshotImageId).toBeNull();
  });

  it("falls back to 'Unknown' platform when none provided", () => {
    const card: RevealedCardData = { ...mockRevealedCard, platform_names: [] };
    const item = revealedToTimelineItem(card);
    expect(item.platform).toBe("Unknown");
  });
});

// ── hiddenToTimelineItem ──────────────────────────────────────────────────────

describe("hiddenToTimelineItem", () => {
  it("maps screenshot correctly and hides other data", () => {
    const item = hiddenToTimelineItem(mockHiddenCard);
    expect(item.id).toBe("2");
    expect(item.screenshotImageId).toBe("shot_hidden_1");
    expect(item.coverImageId).toBeNull();
    expect(item.title).toBe("?");
    expect(item.releaseYear).toBe(0);
    expect(item.isRevealed).toBe(false);
  });

  it("falls back to null screenshot when none provided", () => {
    const card: HiddenCardData = { game_id: 3, screenshot_image_ids: [] };
    const item = hiddenToTimelineItem(card);
    expect(item.screenshotImageId).toBeNull();
  });
});

// ── checkPlatformGuess ────────────────────────────────────────────────────────

describe("checkPlatformGuess", () => {
  it("returns 'correct' for an exact match", () => {
    expect(checkPlatformGuess([1, 2, 3], [1, 2, 3])).toBe("correct");
  });

  it("returns 'correct' when IDs are in a different order", () => {
    expect(checkPlatformGuess([3, 1, 2], [1, 2, 3])).toBe("correct");
  });

  it("returns 'incorrect' when lengths differ", () => {
    expect(checkPlatformGuess([1, 2], [1, 2, 3])).toBe("incorrect");
  });

  it("returns 'incorrect' when IDs do not match", () => {
    expect(checkPlatformGuess([1, 2, 4], [1, 2, 3])).toBe("incorrect");
  });

  it("returns 'correct' for empty sets", () => {
    expect(checkPlatformGuess([], [])).toBe("correct");
  });

  it("returns 'incorrect' when selected is empty but correct is not", () => {
    expect(checkPlatformGuess([], [1])).toBe("incorrect");
  });
});
