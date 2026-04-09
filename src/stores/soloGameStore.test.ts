import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  revealedToTimelineItem,
  hiddenToTimelineItem,
  checkTitleGuess,
} from "./soloGameStore";
import type { useSoloGameStore as UseSoloGameStoreType } from "./soloGameStore";
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

// ── checkTitleGuess ───────────────────────────────────────────────────────────

describe("checkTitleGuess", () => {
  it("returns 'correct' for an exact match", () => {
    expect(checkTitleGuess("Super Mario Bros", "Super Mario Bros")).toBe("correct");
  });

  it("returns 'correct' for a close fuzzy match", () => {
    expect(checkTitleGuess("super mario", "Super Mario Bros")).toBe("correct");
  });

  it("returns 'incorrect' for a completely different title", () => {
    expect(checkTitleGuess("Minecraft", "Super Mario Bros")).toBe("incorrect");
  });
});

// ── Store state machine ───────────────────────────────────────────────────────

describe("useSoloGameStore", () => {
  // We test the store by importing it and exercising its pure / synchronous paths.
  // Async actions (startGame, placeCard) are tested via mocking the API module.

  let store: typeof UseSoloGameStoreType;

  beforeEach(async () => {
    vi.resetModules();
    // Re-import the module so each test gets a fresh store instance
    const mod = await import("./soloGameStore");
    store = mod.useSoloGameStore;
    // Reset to idle
    store.getState().resetGame();
  });

  it("starts in idle phase with zero stats", () => {
    const s = store.getState();
    expect(s.phase).toBe("idle");
    expect(s.score).toBe(0);
    expect(s.timelineItems).toHaveLength(0);
    expect(s.currentCard).toBeNull();
  });

  it("resetGame returns to idle and clears all state", () => {
    store.setState({
      phase: "placing",
      score: 5,
      turnsPlayed: 3,
      timelineItems: [revealedToTimelineItem(mockRevealedCard)],
    });
    store.getState().resetGame();
    const s = store.getState();
    expect(s.phase).toBe("idle");
    expect(s.score).toBe(0);
    expect(s.timelineItems).toHaveLength(0);
  });

  it("submitTitleGuess sets correct result for a matching guess", () => {
    store.setState({
      phase: "revealing",
      revealedCard: mockRevealedCard,
      titleGuessResult: null,
    });
    store.getState().submitTitleGuess("Super Mario Bros");
    expect(store.getState().titleGuessResult).toBe("correct");
  });

  it("submitTitleGuess sets incorrect result for a non-matching guess", () => {
    store.setState({
      phase: "revealing",
      revealedCard: mockRevealedCard,
      titleGuessResult: null,
    });
    store.getState().submitTitleGuess("Minecraft");
    expect(store.getState().titleGuessResult).toBe("incorrect");
  });

  it("submitTitleGuess does nothing when revealedCard is null", () => {
    store.setState({ revealedCard: null, titleGuessResult: null });
    store.getState().submitTitleGuess("anything");
    expect(store.getState().titleGuessResult).toBeNull();
  });

  it("advanceTurn transitions to game_over when lastPlacementCorrect=false", () => {
    store.setState({
      phase: "revealing",
      lastPlacementCorrect: false,
      nextCard: mockHiddenCard,
    });
    store.getState().advanceTurn();
    expect(store.getState().phase).toBe("game_over");
  });

  it("advanceTurn transitions to game_over when nextCard=null", () => {
    store.setState({
      phase: "revealing",
      lastPlacementCorrect: true,
      nextCard: null,
    });
    store.getState().advanceTurn();
    expect(store.getState().phase).toBe("game_over");
  });

  it("advanceTurn advances to placing with next card when correct and nextCard available", () => {
    store.setState({
      phase: "revealing",
      lastPlacementCorrect: true,
      nextCard: mockHiddenCard,
      revealedCard: mockRevealedCard,
    });
    store.getState().advanceTurn();
    const s = store.getState();
    expect(s.phase).toBe("placing");
    expect(s.currentCard).toEqual(mockHiddenCard);
    expect(s.revealedCard).toBeNull();
    expect(s.nextCard).toBeNull();
  });

  it("advanceTurn clears turn-specific state on advance", () => {
    store.setState({
      phase: "revealing",
      lastPlacementCorrect: true,
      nextCard: mockHiddenCard,
      titleGuessResult: "correct",
      validPositions: [1, 2],
    });
    store.getState().advanceTurn();
    const s = store.getState();
    expect(s.titleGuessResult).toBeNull();
    expect(s.validPositions).toBeNull();
    expect(s.lastPlacementCorrect).toBeNull();
  });
});
