// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
import {
  buildMultiplayerShareText,
  buildSoloShareText,
  classifyPlacementOutcome,
  extendShareYearRange,
  shareResult,
} from "./share";

describe("classifyPlacementOutcome", () => {
  it("marks exact chronological placements as correct", () => {
    expect(classifyPlacementOutcome([1998, 2004, 2011], 1, 2001)).toBe("correct");
  });

  it("marks near misses within two years as close", () => {
    expect(classifyPlacementOutcome([1998, 2004, 2011], 1, 2006)).toBe("close");
  });

  it("marks larger misses as wrong", () => {
    expect(classifyPlacementOutcome([1998, 2004, 2011], 1, 2009)).toBe("wrong");
  });
});

describe("extendShareYearRange", () => {
  it("builds and expands the tracked year range", () => {
    const range = extendShareYearRange(extendShareYearRange(null, 2007), 1991);
    expect(range).toEqual({ end: 2007, start: 1991 });
  });
});

describe("buildSoloShareText", () => {
  it("formats the enhanced solo share summary", () => {
    expect(
      buildSoloShareText({
        outcomes: ["correct", "correct", "close", "wrong", "correct"],
        platformBonusEarned: 3,
        platformBonusOpportunities: 4,
        score: 4,
        turnsPlayed: 5,
        yearRange: { end: 2017, start: 1991 },
      }),
    ).toBe(
      "🎮 Gamester — Solo\n🟩🟩🟨🟥🟩 4/5\n⏱ 1991 → 2017\n🎯 Platform bonus: 3/4",
    );
  });
});

describe("buildMultiplayerShareText", () => {
  it("formats the multiplayer standings share summary", () => {
    expect(
      buildMultiplayerShareText({
        outcomes: ["correct", "correct", "correct", "close", "wrong", "correct"],
        placement: 1,
        playerCount: 4,
        platformBonusEarned: 4,
        platformBonusOpportunities: 5,
        score: 5,
        turnsPlayed: 6,
      }),
    ).toBe(
      "🎮 Gamester — Multiplayer\n🏆 1st place (4 players)\n🟩🟩🟩🟨🟥🟩 5/6\n🎯 Platform bonus: 4/5",
    );
  });
});

describe("shareResult", () => {
  it("uses the Web Share API when available", async () => {
    const share = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);
    const success = vi.fn();
    const error = vi.fn();

    await shareResult({
      navigator: { clipboard: { writeText }, share },
      notify: { error, success },
      text: "share text",
      url: "https://gamester.games",
    });

    expect(share).toHaveBeenCalledWith({ text: "share text", url: "https://gamester.games" });
    expect(writeText).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith("Shared!", {
      description: "Your result is ready to post.",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when Web Share is unavailable", async () => {
    const writeText = vi.fn(async () => undefined);
    const success = vi.fn();
    const error = vi.fn();

    await shareResult({
      navigator: { clipboard: { writeText } },
      notify: { error, success },
      text: "share text",
    });

    expect(writeText).toHaveBeenCalledWith("share text");
    expect(success).toHaveBeenCalledWith("Copied to clipboard!", {
      description: "Your result is ready to paste.",
    });
    expect(error).not.toHaveBeenCalled();
  });
});
