// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, expect, vi, beforeEach } from "vitest";
import { revealedToTimelineItem } from "./soloGameStore";
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

// ── placeCard, moveCardToCorrectPosition, revealMovedCard ─────────────────────

describe("useSoloGameStore — placeCard / position", () => {
  let store: typeof UseSoloGameStoreType;

  beforeEach(async () => {
    vi.resetModules();
    mockStartGame.mockReset();
    mockSubmitTurn.mockReset();
    const mod = await import("./soloGameStore");
    store = mod.useSoloGameStore;
    store.getState().resetGame();
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

  it("placeCard (standard variant) does not increment bonusOpportunities on correct placement", async () => {
    mockSubmitTurn.mockResolvedValueOnce({
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
      // No platform_options — server skips them for standard
    });

    store.setState({
      phase: "placing",
      sessionId: "session-1",
      variant: "standard",
      currentCard: mockHiddenCard,
      timelineItems: [revealedToTimelineItem(mockRevealedCard)],
      bonusOpportunities: 0,
    });

    await store.getState().placeCard(1);

    expect(store.getState().bonusOpportunities).toBe(0);
    expect(store.getState().availablePlatforms).toHaveLength(0);
  });

  it("placeCard (pro variant) increments bonusOpportunities on correct placement", async () => {
    mockSubmitTurn.mockResolvedValueOnce({
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
      platform_options: [{ id: 1, name: "PS4" }],
      correct_platform_ids: [1],
    });

    store.setState({
      phase: "placing",
      sessionId: "session-1",
      variant: "pro",
      currentCard: mockHiddenCard,
      timelineItems: [revealedToTimelineItem(mockRevealedCard)],
      bonusOpportunities: 0,
    });

    await store.getState().placeCard(1);

    expect(store.getState().bonusOpportunities).toBe(1);
    expect(store.getState().availablePlatforms).toHaveLength(1);
  });

  it("placeCard (standard variant) passes variant to the API", async () => {
    mockSubmitTurn.mockResolvedValueOnce({
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
    });

    store.setState({
      phase: "placing",
      sessionId: "session-xyz",
      variant: "standard",
      currentCard: mockHiddenCard,
      timelineItems: [revealedToTimelineItem(mockRevealedCard)],
    });

    await store.getState().placeCard(0);

    expect(mockSubmitTurn).toHaveBeenCalledWith("session-xyz", 0, "standard");
  });
});
