import { describe, it, expect, vi, beforeEach } from "vitest";
import { revealedToTimelineItem, hiddenToTimelineItem, checkPlatformGuess } from "./soloGameStore";
import type { useSoloGameStore as UseSoloGameStoreType } from "./soloGameStore";
import type { RevealedCardData, HiddenCardData, TurnResponse } from "@/lib/solo/api";

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

const mockNextCard: HiddenCardData = {
  game_id: 3,
  screenshot_image_ids: ["shot_hidden_3"],
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

  it("placeCard reveals the tentative card in place after a correct submission", async () => {
    const deferred = createDeferred<TurnResponse>();
    mockSubmitTurn.mockReturnValueOnce(deferred.promise);

    store.setState({
      phase: "placing",
      sessionId: "session-1",
      currentCard: mockHiddenCard,
      timelineItems: [revealedToTimelineItem(mockRevealedCard)],
    });

    const placePromise = store.getState().placeCard(1);
    const submittingState = store.getState();

    expect(submittingState.phase).toBe("submitting");
    expect(submittingState.droppedPosition).toBe(1);
    expect(submittingState.timelineItems).toHaveLength(2);
    expect(submittingState.timelineItems[0]?.id).toBe("1");
    expect(submittingState.timelineItems[1]).toMatchObject({
      id: "2",
      title: "?",
      releaseYear: 0,
      isRevealed: false,
    });

    deferred.resolve({
      correct: true,
      revealed_card: {
        ...mockRevealedCard,
        game_id: mockHiddenCard.game_id,
        screenshot_image_ids: mockHiddenCard.screenshot_image_ids,
      },
      score: 1,
      turns_played: 1,
      current_streak: 1,
      best_streak: 1,
      game_over: false,
      next_card: mockNextCard,
      platform_options: [],
      correct_platform_ids: [],
    });

    await placePromise;

    const revealingState = store.getState();

    expect(revealingState.phase).toBe("revealing");
    expect(revealingState.revealedCard).toMatchObject({
      game_id: mockHiddenCard.game_id,
      name: mockRevealedCard.name,
    });
    expect(revealingState.droppedPosition).toBe(1);
    expect(revealingState.lastPlacementCorrect).toBe(true);
    expect(revealingState.timelineItems[0]?.id).toBe("1");
    expect(revealingState.timelineItems[1]).toMatchObject({
      id: "2",
      title: "Super Mario Bros",
      releaseYear: 1985,
      platform: "NES",
      isRevealed: true,
    });
  });

  it("placeCard restores the original timeline when submission fails", async () => {
    mockSubmitTurn.mockRejectedValueOnce(new Error("submit failed"));
    const originalTimeline = [revealedToTimelineItem(mockRevealedCard)];

    store.setState({
      phase: "placing",
      sessionId: "session-1",
      currentCard: mockHiddenCard,
      timelineItems: originalTimeline,
      error: null,
    });

    await store.getState().placeCard(1);

    const state = store.getState();

    expect(state.phase).toBe("placing");
    expect(state.timelineItems).toEqual(originalTimeline);
    expect(state.droppedPosition).toBeNull();
    expect(state.correctionTargetPosition).toBeNull();
    expect(state.error).toBe("submit failed");
  });

  it("moveCardToCorrectPosition moves an incorrect tentative card before it reveals", async () => {
    mockSubmitTurn.mockResolvedValueOnce({
      correct: false,
      revealed_card: {
        ...mockRevealedCard,
        game_id: mockHiddenCard.game_id,
        screenshot_image_ids: mockHiddenCard.screenshot_image_ids,
      },
      score: 1,
      turns_played: 1,
      current_streak: 0,
      best_streak: 1,
      game_over: true,
      valid_positions: [0],
    });

    store.setState({
      phase: "placing",
      sessionId: "session-1",
      currentCard: mockHiddenCard,
      timelineItems: [revealedToTimelineItem(mockRevealedCard)],
    });

    await store.getState().placeCard(1);

    const incorrectState = store.getState();
    expect(incorrectState.phase).toBe("revealing");
    expect(incorrectState.lastPlacementCorrect).toBe(false);
    expect(incorrectState.droppedPosition).toBe(1);
    expect(incorrectState.correctionTargetPosition).toBe(0);
    expect(incorrectState.timelineItems[1]).toMatchObject({
      id: "2",
      isRevealed: false,
      title: "?",
    });

    store.getState().moveCardToCorrectPosition();

    const movedState = store.getState();
    expect(movedState.droppedPosition).toBe(0);
    expect(movedState.timelineItems[0]).toMatchObject({
      id: "2",
      isRevealed: false,
      title: "?",
    });
    expect(movedState.timelineItems[1]?.id).toBe("1");

    store.getState().revealMovedCard();

    const revealedState = store.getState();
    expect(revealedState.correctionTargetPosition).toBeNull();
    expect(revealedState.timelineItems[0]).toMatchObject({
      id: "2",
      title: "Super Mario Bros",
      releaseYear: 1985,
      platform: "NES",
      isRevealed: true,
    });
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
});
