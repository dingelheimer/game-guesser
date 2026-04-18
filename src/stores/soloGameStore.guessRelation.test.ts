// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, expect, vi, beforeEach } from "vitest";
import { revealedToTimelineItem } from "./soloGameStore";
import type { useSoloGameStore as UseSoloGameStoreType } from "./soloGameStore";
import type { RevealedCardData, HiddenCardData, TurnResponse } from "@/lib/solo/api";

const { mockSubmitHigherLowerTurn } = vi.hoisted(() => ({
  mockSubmitHigherLowerTurn: vi.fn(),
}));

vi.mock("@/lib/solo/api", () => ({
  startGame: vi.fn(),
  submitTurn: vi.fn(),
  submitHigherLowerTurn: mockSubmitHigherLowerTurn,
}));

// ── Test fixtures ─────────────────────────────────────────────────────────────

const referenceCard: RevealedCardData = {
  game_id: 10,
  name: "GTA V",
  release_year: 2013,
  cover_image_id: "cover_gtav",
  screenshot_image_ids: ["shot_gtav"],
  platform_names: ["PS3", "PS4"],
};

const newRevealedCard: RevealedCardData = {
  game_id: 20,
  name: "Half-Life 2",
  release_year: 2004,
  cover_image_id: "cover_hl2",
  screenshot_image_ids: ["shot_hl2"],
  platform_names: ["PC"],
};

const nextHiddenCard: HiddenCardData = {
  game_id: 30,
  screenshot_image_ids: ["shot_hidden_30"],
};

const currentHiddenCard: HiddenCardData = {
  game_id: 20,
  screenshot_image_ids: ["shot_hl2"],
};

// ── guessRelation ─────────────────────────────────────────────────────────────

describe("useSoloGameStore — guessRelation", () => {
  let store: typeof UseSoloGameStoreType;

  beforeEach(async () => {
    vi.resetModules();
    mockSubmitHigherLowerTurn.mockReset();
    const mod = await import("./soloGameStore");
    store = mod.useSoloGameStore;
    store.getState().resetGame();
  });

  it("transitions to submitting immediately after call", async () => {
    let resolvePromise!: (value: TurnResponse) => void;
    mockSubmitHigherLowerTurn.mockReturnValueOnce(
      new Promise<TurnResponse>((res) => {
        resolvePromise = res;
      }),
    );

    store.setState({
      phase: "placing",
      sessionId: "sess-hl",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: [revealedToTimelineItem(referenceCard)],
    });

    const guessPromise = store.getState().guessRelation("lower");
    expect(store.getState().phase).toBe("submitting");
    expect(store.getState().guess).toBe("lower");

    resolvePromise({
      correct: true,
      revealed_card: newRevealedCard,
      score: 1,
      turns_played: 1,
      current_streak: 1,
      best_streak: 1,
      game_over: false,
      next_card: nextHiddenCard,
    });
    await guessPromise;
  });

  it("correct guess: updates referenceCard, timeline stays at 1 card, sets nextCard", async () => {
    mockSubmitHigherLowerTurn.mockResolvedValueOnce({
      correct: true,
      revealed_card: newRevealedCard,
      score: 1,
      turns_played: 1,
      current_streak: 1,
      best_streak: 1,
      game_over: false,
      next_card: nextHiddenCard,
    } satisfies TurnResponse);

    store.setState({
      phase: "placing",
      sessionId: "sess-hl",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: [revealedToTimelineItem(referenceCard)],
      referenceCard,
    });

    await store.getState().guessRelation("lower");

    const s = store.getState();
    expect(s.phase).toBe("revealing");
    expect(s.lastPlacementCorrect).toBe(true);
    expect(s.revealedCard).toEqual(newRevealedCard);
    expect(s.referenceCard).toEqual(newRevealedCard);
    // Timeline always has exactly one entry (the new reference)
    expect(s.timelineItems).toHaveLength(1);
    expect(s.timelineItems[0]).toMatchObject({
      id: String(newRevealedCard.game_id),
      title: newRevealedCard.name,
      releaseYear: newRevealedCard.release_year,
      isRevealed: true,
    });
    expect(s.nextCard).toEqual(nextHiddenCard);
    expect(s.score).toBe(1);
  });

  it("correct guess: calls submitHigherLowerTurn with session id and guess", async () => {
    mockSubmitHigherLowerTurn.mockResolvedValueOnce({
      correct: true,
      revealed_card: newRevealedCard,
      score: 1,
      turns_played: 1,
      current_streak: 1,
      best_streak: 1,
      game_over: false,
      next_card: nextHiddenCard,
    } satisfies TurnResponse);

    store.setState({
      phase: "placing",
      sessionId: "sess-abc",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: [revealedToTimelineItem(referenceCard)],
    });

    await store.getState().guessRelation("higher");

    expect(mockSubmitHigherLowerTurn).toHaveBeenCalledWith("sess-abc", "higher");
  });

  it("incorrect guess: keeps old timeline, sets lastPlacementCorrect=false, does not update referenceCard", async () => {
    mockSubmitHigherLowerTurn.mockResolvedValueOnce({
      correct: false,
      revealed_card: newRevealedCard,
      score: 0,
      turns_played: 1,
      current_streak: 0,
      best_streak: 0,
      game_over: true,
    } satisfies TurnResponse);

    const originalTimeline = [revealedToTimelineItem(referenceCard)];

    store.setState({
      phase: "placing",
      sessionId: "sess-hl",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: originalTimeline,
      referenceCard,
    });

    await store.getState().guessRelation("higher");

    const s = store.getState();
    expect(s.phase).toBe("revealing");
    expect(s.lastPlacementCorrect).toBe(false);
    expect(s.revealedCard).toEqual(newRevealedCard);
    // Reference card unchanged
    expect(s.referenceCard).toEqual(referenceCard);
    // Timeline unchanged (still shows old reference)
    expect(s.timelineItems).toHaveLength(1);
    expect(s.timelineItems[0]).toMatchObject({ id: String(referenceCard.game_id) });
  });

  it("correct guess with game_over (deck exhaustion): no nextCard, advanceTurn ends game", async () => {
    mockSubmitHigherLowerTurn.mockResolvedValueOnce({
      correct: true,
      revealed_card: newRevealedCard,
      score: 5,
      turns_played: 5,
      current_streak: 5,
      best_streak: 5,
      game_over: true,
      // no next_card — deck exhausted
    } satisfies TurnResponse);

    store.setState({
      phase: "placing",
      sessionId: "sess-hl",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: [revealedToTimelineItem(referenceCard)],
      referenceCard,
    });

    await store.getState().guessRelation("lower");

    const s = store.getState();
    expect(s.phase).toBe("revealing");
    expect(s.lastPlacementCorrect).toBe(true);
    expect(s.nextCard).toBeNull();

    // advanceTurn should end game since nextCard is null
    store.getState().advanceTurn();
    expect(store.getState().phase).toBe("game_over");
  });

  it("guessRelation reverts to placing on API error", async () => {
    mockSubmitHigherLowerTurn.mockRejectedValueOnce(new Error("network failure"));

    store.setState({
      phase: "placing",
      sessionId: "sess-hl",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: [revealedToTimelineItem(referenceCard)],
    });

    await store.getState().guessRelation("lower");

    const s = store.getState();
    expect(s.phase).toBe("placing");
    expect(s.guess).toBeNull();
    expect(s.error).toBe("network failure");
  });

  it("guessRelation is no-op when not in placing phase", async () => {
    store.setState({ phase: "revealing" });
    await store.getState().guessRelation("higher");
    expect(mockSubmitHigherLowerTurn).not.toHaveBeenCalled();
  });

  it("shareOutcomes records correct for a correct guess", async () => {
    mockSubmitHigherLowerTurn.mockResolvedValueOnce({
      correct: true,
      revealed_card: newRevealedCard,
      score: 1,
      turns_played: 1,
      current_streak: 1,
      best_streak: 1,
      game_over: false,
      next_card: nextHiddenCard,
    } satisfies TurnResponse);

    store.setState({
      phase: "placing",
      sessionId: "sess-hl",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: [revealedToTimelineItem(referenceCard)],
      shareOutcomes: [],
    });

    await store.getState().guessRelation("lower");

    expect(store.getState().shareOutcomes).toEqual(["correct"]);
  });

  it("shareOutcomes records wrong for an incorrect guess", async () => {
    mockSubmitHigherLowerTurn.mockResolvedValueOnce({
      correct: false,
      revealed_card: newRevealedCard,
      score: 0,
      turns_played: 1,
      current_streak: 0,
      best_streak: 0,
      game_over: true,
    } satisfies TurnResponse);

    store.setState({
      phase: "placing",
      sessionId: "sess-hl",
      variant: "higher_lower",
      currentCard: currentHiddenCard,
      timelineItems: [revealedToTimelineItem(referenceCard)],
      shareOutcomes: [],
    });

    await store.getState().guessRelation("higher");

    expect(store.getState().shareOutcomes).toEqual(["wrong"]);
  });
});
