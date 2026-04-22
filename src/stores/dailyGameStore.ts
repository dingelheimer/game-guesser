// SPDX-License-Identifier: AGPL-3.0-only
import { create } from "zustand";
import {
  hiddenToTimelineItem,
  insertAtPosition,
  revealedToTimelineItem,
} from "./dailyGameStore.helpers";
import type { DailyGameState } from "./dailyGameStore.helpers";
import * as api from "@/lib/daily/api";

export type { DailyGamePhase, DailyGameState, DailyStreakData } from "./dailyGameStore.helpers";
export {
  buildPlacementReviewItems,
  revealedToTimelineItem,
  hiddenToTimelineItem,
} from "./dailyGameStore.helpers";

const ANON_ID_KEY = "game_guesser_daily_anon_id";

function getOrCreateAnonymousId(): string {
  try {
    const stored = localStorage.getItem(ANON_ID_KEY);
    if (stored !== null) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export const useDailyGameStore = create<DailyGameState>()((set, get) => ({
  phase: "idle",
  error: null,

  resultId: null,
  challengeNumber: null,
  challengeDate: null,
  totalCards: 10,
  anonymousId: null,

  currentCard: null,
  revealedCard: null,
  nextCard: null,

  timelineItems: [],
  droppedPosition: null,

  score: 0,
  turnsPlayed: 0,
  extraTryAvailable: true,
  placements: [],
  revealedCards: {},

  lastPlacementCorrect: null,
  validPositions: null,
  gameOver: false,
  streak: null,

  async startDaily() {
    set({ phase: "loading", error: null });

    const anonymousId = getOrCreateAnonymousId();
    set({ anonymousId });

    try {
      const res = await api.startDaily(anonymousId);

      if (res.status === "completed") {
        set({
          phase: "game_over",
          resultId: res.result_id,
          challengeNumber: res.challenge_number,
          challengeDate: res.challenge_date,
          totalCards: res.total_cards,
          score: res.score,
          turnsPlayed: res.turns_played,
          extraTryAvailable: !res.extra_try_used,
          placements: res.placements,
          timelineItems: [],
          revealedCards: {},
          gameOver: true,
          streak: res.streak,
        });
        return;
      }

      // "started" or "in_progress": build timeline from anchor + any already-placed cards.
      const anchorItem = revealedToTimelineItem(res.anchor_card);
      const timelineItems = [
        anchorItem,
        // For in_progress resumes, subsequent entries only have game_id + release_year.
        ...res.timeline.slice(1).map((entry) => ({
          id: String(entry.game_id),
          screenshotImageId: null,
          coverImageId: null,
          title: "—",
          releaseYear: entry.release_year,
          platform: "?",
          isRevealed: true,
        })),
      ];

      set({
        phase: "placing",
        resultId: res.result_id,
        challengeNumber: res.challenge_number,
        challengeDate: res.challenge_date,
        totalCards: res.total_cards,
        currentCard: res.current_card,
        nextCard: null,
        revealedCard: null,
        timelineItems,
        droppedPosition: null,
        score: res.score,
        turnsPlayed: res.turns_played,
        extraTryAvailable: res.extra_try_available,
        placements: res.placements,
        revealedCards: { [res.anchor_card.game_id]: res.anchor_card },
        lastPlacementCorrect: null,
        validPositions: null,
        gameOver: false,
        streak: res.streak,
      });
    } catch (err) {
      set({
        phase: "idle",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async placeCard(position: number) {
    const { phase, resultId, currentCard, timelineItems, anonymousId } = get();
    if (phase !== "placing" || resultId === null || currentCard === null) return;

    // Tentatively insert the hidden card at the chosen position for visual feedback.
    const tentativeTimelineItems = insertAtPosition(
      timelineItems,
      hiddenToTimelineItem(currentCard),
      position,
    );

    set({
      phase: "submitting",
      error: null,
      droppedPosition: position,
      timelineItems: tentativeTimelineItems,
    });

    try {
      const result = await api.submitDailyTurn(resultId, position, anonymousId ?? undefined);

      // Correct: replace the tentative hidden card with the revealed card.
      // Wrong: card is discarded — revert timeline to pre-placement state.
      const newTimelineItems = result.correct
        ? tentativeTimelineItems.map((item, index) =>
            index === position ? revealedToTimelineItem(result.revealed_card) : item,
          )
        : timelineItems;

      set({
        phase: "revealing",
        revealedCard: result.revealed_card,
        nextCard: result.next_card ?? null,
        timelineItems: newTimelineItems,
        droppedPosition: position,
        score: result.score,
        turnsPlayed: result.turns_played,
        extraTryAvailable: result.extra_try_available,
        lastPlacementCorrect: result.correct,
        validPositions: result.valid_positions ?? null,
        gameOver: result.game_over,
        revealedCards: {
          ...get().revealedCards,
          [result.revealed_card.game_id]: result.revealed_card,
        },
      });
    } catch (err) {
      set({
        phase: "placing",
        timelineItems,
        droppedPosition: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  advanceTurn() {
    const { phase, nextCard, gameOver } = get();
    if (phase !== "revealing") return;

    if (gameOver || nextCard === null) {
      set({ phase: "game_over" });
      return;
    }

    set({
      phase: "placing",
      currentCard: nextCard,
      nextCard: null,
      revealedCard: null,
      droppedPosition: null,
      lastPlacementCorrect: null,
      validPositions: null,
    });
  },

  resetGame() {
    set({
      phase: "idle",
      error: null,
      resultId: null,
      challengeNumber: null,
      challengeDate: null,
      totalCards: 10,
      anonymousId: null,
      currentCard: null,
      revealedCard: null,
      nextCard: null,
      timelineItems: [],
      droppedPosition: null,
      score: 0,
      turnsPlayed: 0,
      extraTryAvailable: true,
      placements: [],
      revealedCards: {},
      lastPlacementCorrect: null,
      validPositions: null,
      gameOver: false,
      streak: null,
    });
  },
}));
