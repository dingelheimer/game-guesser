// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, expect, vi, beforeEach } from "vitest";
import { revealedToTimelineItem } from "./soloGameStore";
import type { useSoloGameStore as UseSoloGameStoreType } from "./soloGameStore";
import type { RevealedCardData, HiddenCardData } from "@/lib/solo/api";

const { mockStartGame, mockSubmitTurn } = vi.hoisted(() => ({
  mockStartGame: vi.fn(),
  mockSubmitTurn: vi.fn(),
}));

vi.mock("@/lib/solo/api", () => ({
  startGame: mockStartGame,
  submitTurn: mockSubmitTurn,
}));

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

// ── Store state machine ───────────────────────────────────────────────────────

describe("useSoloGameStore", () => {
  // We test the store by importing it and exercising its pure / synchronous paths.
  // Async actions (startGame, placeCard) are tested via mocking the API module.

  let store: typeof UseSoloGameStoreType;

  beforeEach(async () => {
    vi.resetModules();
    mockStartGame.mockReset();
    mockSubmitTurn.mockReset();
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
    expect(s.droppedPosition).toBeNull();
    expect(s.correctionTargetPosition).toBeNull();
    expect(s.bonusPointsEarned).toBe(0);
    expect(s.bonusOpportunities).toBe(0);
  });

  it("resetGame returns to idle and clears all state", () => {
    store.setState({
      phase: "placing",
      score: 5,
      turnsPlayed: 3,
      timelineItems: [revealedToTimelineItem(mockRevealedCard)],
      bonusPointsEarned: 2,
      bonusOpportunities: 3,
      availablePlatforms: [{ id: 1, name: "PS4" }],
      correctPlatformIds: [1],
      platformBonusResult: "correct",
    });
    store.getState().resetGame();
    const s = store.getState();
    expect(s.phase).toBe("idle");
    expect(s.score).toBe(0);
    expect(s.timelineItems).toHaveLength(0);
    expect(s.droppedPosition).toBeNull();
    expect(s.correctionTargetPosition).toBeNull();
    expect(s.bonusPointsEarned).toBe(0);
    expect(s.bonusOpportunities).toBe(0);
    expect(s.availablePlatforms).toHaveLength(0);
    expect(s.correctPlatformIds).toHaveLength(0);
    expect(s.platformBonusResult).toBeNull();
  });

  it("submitPlatformGuess sets correct result and increments score for exact match", () => {
    store.setState({
      phase: "revealing",
      score: 2,
      bonusPointsEarned: 0,
      correctPlatformIds: [1, 2, 3],
      platformBonusResult: null,
    });
    store.getState().submitPlatformGuess([3, 1, 2]);
    const s = store.getState();
    expect(s.platformBonusResult).toBe("correct");
    expect(s.score).toBe(3);
    expect(s.bonusPointsEarned).toBe(1);
  });

  it("submitPlatformGuess sets incorrect result and does not change score for wrong selection", () => {
    store.setState({
      phase: "revealing",
      score: 2,
      bonusPointsEarned: 1,
      correctPlatformIds: [1, 2, 3],
      platformBonusResult: null,
    });
    store.getState().submitPlatformGuess([1, 2]);
    const s = store.getState();
    expect(s.platformBonusResult).toBe("incorrect");
    expect(s.score).toBe(2);
    expect(s.bonusPointsEarned).toBe(1);
  });

  it("submitPlatformGuess does nothing when already submitted", () => {
    store.setState({
      score: 2,
      bonusPointsEarned: 1,
      correctPlatformIds: [1, 2, 3],
      platformBonusResult: "incorrect",
    });
    store.getState().submitPlatformGuess([1, 2, 3]);
    const s = store.getState();
    expect(s.platformBonusResult).toBe("incorrect");
    expect(s.score).toBe(2);
    expect(s.bonusPointsEarned).toBe(1);
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
      platformBonusResult: "correct",
      availablePlatforms: [{ id: 1, name: "PS4" }],
      correctPlatformIds: [1],
      validPositions: [1, 2],
    });
    store.getState().advanceTurn();
    const s = store.getState();
    expect(s.platformBonusResult).toBeNull();
    expect(s.availablePlatforms).toHaveLength(0);
    expect(s.correctPlatformIds).toHaveLength(0);
    expect(s.validPositions).toBeNull();
    expect(s.lastPlacementCorrect).toBeNull();
  });

  it("advanceTurn keeps PRO reveals blocked until the platform bonus is answered", () => {
    store.setState({
      phase: "revealing",
      variant: "pro",
      lastPlacementCorrect: true,
      nextCard: mockHiddenCard,
      availablePlatforms: [{ id: 1, name: "PC" }],
      platformBonusResult: null,
    });

    store.getState().advanceTurn();

    const s = store.getState();
    expect(s.phase).toBe("revealing");
    expect(s.currentCard).toBeNull();
  });

  it("advanceTurn ends a PRO run after an incorrect platform bonus", () => {
    store.setState({
      phase: "revealing",
      variant: "pro",
      lastPlacementCorrect: true,
      nextCard: mockHiddenCard,
      availablePlatforms: [{ id: 1, name: "PC" }],
      platformBonusResult: "incorrect",
    });

    store.getState().advanceTurn();

    expect(store.getState().phase).toBe("game_over");
  });

  it("startGame passes house rules to the API and stores them in state", async () => {
    mockStartGame.mockResolvedValueOnce({
      session_id: "ses-1",
      difficulty: "easy",
      score: 0,
      timeline: [mockRevealedCard],
      current_card: mockHiddenCard,
    });

    const houseRules = { genreLockId: 7, consoleLockFamily: "nintendo", decadeStart: 1990 };
    await store.getState().startGame("easy", houseRules, "pro");

    expect(mockStartGame).toHaveBeenCalledWith("easy", houseRules);
    const s = store.getState();
    expect(s.phase).toBe("placing");
    expect(s.houseRules).toEqual(houseRules);
    expect(s.variant).toBe("pro");
  });

  it("startGame without house rules stores null in state", async () => {
    mockStartGame.mockResolvedValueOnce({
      session_id: "ses-2",
      difficulty: "hard",
      score: 0,
      timeline: [mockRevealedCard],
      current_card: mockHiddenCard,
    });

    await store.getState().startGame("hard");

    expect(mockStartGame).toHaveBeenCalledWith("hard", undefined);
    expect(store.getState().houseRules).toBeNull();
    expect(store.getState().variant).toBe("standard");
  });
});
