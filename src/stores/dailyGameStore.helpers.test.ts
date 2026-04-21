// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  hiddenToTimelineItem,
  insertAtPosition,
  revealedToTimelineItem,
} from "./dailyGameStore.helpers";
import type { HiddenCardData, RevealedCardData } from "@/lib/daily/api";

const REVEALED: RevealedCardData = {
  game_id: 42,
  name: "Test Game",
  release_year: 2001,
  cover_image_id: "cover123",
  screenshot_image_ids: ["shot1", "shot2"],
  platform_names: ["PlayStation 2", "PC"],
};

const HIDDEN: HiddenCardData = {
  game_id: 7,
  screenshot_image_ids: ["shot3"],
};

describe("revealedToTimelineItem", () => {
  it("maps game_id to string id", () => {
    expect(revealedToTimelineItem(REVEALED).id).toBe("42");
  });

  it("uses the first screenshot", () => {
    expect(revealedToTimelineItem(REVEALED).screenshotImageId).toBe("shot1");
  });

  it("uses cover_image_id", () => {
    expect(revealedToTimelineItem(REVEALED).coverImageId).toBe("cover123");
  });

  it("uses name as title", () => {
    expect(revealedToTimelineItem(REVEALED).title).toBe("Test Game");
  });

  it("uses release_year", () => {
    expect(revealedToTimelineItem(REVEALED).releaseYear).toBe(2001);
  });

  it("uses the first platform name", () => {
    expect(revealedToTimelineItem(REVEALED).platform).toBe("PlayStation 2");
  });

  it("marks the item as revealed", () => {
    expect(revealedToTimelineItem(REVEALED).isRevealed).toBe(true);
  });

  it("falls back to 'Unknown' when platform_names is empty", () => {
    const card: RevealedCardData = { ...REVEALED, platform_names: [] };
    expect(revealedToTimelineItem(card).platform).toBe("Unknown");
  });

  it("falls back to null screenshotImageId when array is empty", () => {
    const card: RevealedCardData = { ...REVEALED, screenshot_image_ids: [] };
    expect(revealedToTimelineItem(card).screenshotImageId).toBeNull();
  });
});

describe("hiddenToTimelineItem", () => {
  it("maps game_id to string id", () => {
    expect(hiddenToTimelineItem(HIDDEN).id).toBe("7");
  });

  it("uses the first screenshot", () => {
    expect(hiddenToTimelineItem(HIDDEN).screenshotImageId).toBe("shot3");
  });

  it("sets coverImageId to null", () => {
    expect(hiddenToTimelineItem(HIDDEN).coverImageId).toBeNull();
  });

  it("sets title to '?'", () => {
    expect(hiddenToTimelineItem(HIDDEN).title).toBe("?");
  });

  it("sets releaseYear to 0", () => {
    expect(hiddenToTimelineItem(HIDDEN).releaseYear).toBe(0);
  });

  it("marks the item as not revealed", () => {
    expect(hiddenToTimelineItem(HIDDEN).isRevealed).toBe(false);
  });

  it("falls back to null screenshotImageId when array is empty", () => {
    const card: HiddenCardData = { game_id: 1, screenshot_image_ids: [] };
    expect(hiddenToTimelineItem(card).screenshotImageId).toBeNull();
  });
});

describe("insertAtPosition", () => {
  it("inserts at position 0 (prepend)", () => {
    expect(insertAtPosition([2, 3, 4], 1, 0)).toEqual([1, 2, 3, 4]);
  });

  it("inserts at the end (append)", () => {
    expect(insertAtPosition([1, 2, 3], 4, 3)).toEqual([1, 2, 3, 4]);
  });

  it("inserts in the middle", () => {
    expect(insertAtPosition([1, 3, 4], 2, 1)).toEqual([1, 2, 3, 4]);
  });

  it("does not mutate the original array", () => {
    const original = [1, 2, 3];
    insertAtPosition(original, 0, 0);
    expect(original).toEqual([1, 2, 3]);
  });

  it("inserts into an empty array", () => {
    expect(insertAtPosition([], "a", 0)).toEqual(["a"]);
  });

  it("returns a new array reference", () => {
    const original = [1, 2];
    expect(insertAtPosition(original, 3, 2)).not.toBe(original);
  });
});
