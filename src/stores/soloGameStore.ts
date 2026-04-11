import { create } from "zustand";
import type { DifficultyTier } from "@/types/supabase";
import type { TimelineItem } from "@/components/game/Timeline";
import * as api from "@/lib/solo/api";
import type { HiddenCardData, RevealedCardData } from "@/lib/solo/api";

// ── Phase type ────────────────────────────────────────────────────────────────

export type GamePhase = "idle" | "starting" | "placing" | "submitting" | "revealing" | "game_over";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function revealedToTimelineItem(card: RevealedCardData): TimelineItem {
  return {
    id: String(card.game_id),
    screenshotImageId: card.screenshot_image_ids[0] ?? null,
    coverImageId: card.cover_image_id,
    title: card.name,
    releaseYear: card.release_year,
    platform: card.platform_names[0] ?? "Unknown",
    isRevealed: true,
  };
}

export function hiddenToTimelineItem(card: HiddenCardData): TimelineItem {
  return {
    id: String(card.game_id),
    screenshotImageId: card.screenshot_image_ids[0] ?? null,
    coverImageId: null,
    title: "?",
    releaseYear: 0,
    platform: "?",
    isRevealed: false,
  };
}

function insertAtPosition<T>(arr: T[], item: T, position: number): T[] {
  return [...arr.slice(0, position), item, ...arr.slice(position)];
}

export function checkPlatformGuess(selected: number[], correct: number[]): "correct" | "incorrect" {
  if (selected.length !== correct.length) return "incorrect";
  const sortedSelected = [...selected].sort((a, b) => a - b);
  const sortedCorrect = [...correct].sort((a, b) => a - b);
  return sortedSelected.every((id, i) => id === sortedCorrect[i]) ? "correct" : "incorrect";
}

// ── Platform option type ──────────────────────────────────────────────────────

export interface PlatformOption {
  id: number;
  name: string;
}

// ── Store interface ───────────────────────────────────────────────────────────

export interface SoloGameState {
  phase: GamePhase;
  error: string | null;

  sessionId: string | null;
  difficulty: DifficultyTier | null;

  /** The card the player is currently placing (hidden — screenshot only). */
  currentCard: HiddenCardData | null;
  /** Queued next card, available after a correct turn. */
  nextCard: HiddenCardData | null;
  /** The card shown after reveal (correct or incorrect). */
  revealedCard: RevealedCardData | null;

  timelineItems: TimelineItem[];

  score: number;
  turnsPlayed: number;
  bestStreak: number;
  currentStreak: number;
  bonusPointsEarned: number;
  bonusOpportunities: number;

  /** Result of the last placement. null during placing/submitting. */
  lastPlacementCorrect: boolean | null;
  /** Valid insertion indices returned when placement is incorrect. */
  validPositions: number[] | null;

  /** Platform options shown to the player after a correct placement. */
  availablePlatforms: PlatformOption[];
  /** Correct platform IDs for client-side bonus validation. */
  correctPlatformIds: number[];
  /** Result of the platform bonus round. null until submitted. */
  platformBonusResult: "correct" | "incorrect" | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  startGame: (difficulty: DifficultyTier) => Promise<void>;
  placeCard: (position: number) => Promise<void>;
  submitPlatformGuess: (selectedPlatformIds: number[]) => void;
  advanceTurn: () => void;
  resetGame: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSoloGameStore = create<SoloGameState>()((set, get) => ({
  phase: "idle",
  error: null,

  sessionId: null,
  difficulty: null,

  currentCard: null,
  nextCard: null,
  revealedCard: null,

  timelineItems: [],

  score: 0,
  turnsPlayed: 0,
  bestStreak: 0,
  currentStreak: 0,
  bonusPointsEarned: 0,
  bonusOpportunities: 0,

  lastPlacementCorrect: null,
  validPositions: null,
  availablePlatforms: [],
  correctPlatformIds: [],
  platformBonusResult: null,

  async startGame(difficulty: DifficultyTier) {
    set({ phase: "starting", error: null });
    try {
      const res = await api.startGame(difficulty);
      set({
        phase: "placing",
        sessionId: res.session_id,
        difficulty,
        currentCard: res.current_card,
        nextCard: null,
        revealedCard: null,
        timelineItems: res.timeline.map(revealedToTimelineItem),
        score: 0,
        turnsPlayed: 0,
        bestStreak: 0,
        currentStreak: 0,
        bonusPointsEarned: 0,
        bonusOpportunities: 0,
        lastPlacementCorrect: null,
        validPositions: null,
        availablePlatforms: [],
        correctPlatformIds: [],
        platformBonusResult: null,
      });
    } catch (err) {
      set({
        phase: "idle",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async placeCard(position: number) {
    const { phase, sessionId, currentCard, timelineItems } = get();
    if (phase !== "placing" || sessionId === null || currentCard === null) return;

    set({ phase: "submitting", error: null });
    try {
      const result = await api.submitTurn(sessionId, position);

      const newTimelineItems = result.correct
        ? insertAtPosition(timelineItems, revealedToTimelineItem(result.revealed_card), position)
        : timelineItems;

      set((state) => ({
        phase: "revealing",
        revealedCard: result.revealed_card,
        nextCard: result.next_card ?? null,
        timelineItems: newTimelineItems,
        score: result.score,
        turnsPlayed: result.turns_played,
        bestStreak: result.best_streak,
        currentStreak: result.current_streak,
        bonusPointsEarned: state.bonusPointsEarned,
        bonusOpportunities: result.correct
          ? state.bonusOpportunities + 1
          : state.bonusOpportunities,
        lastPlacementCorrect: result.correct,
        validPositions: result.valid_positions ?? null,
        availablePlatforms: result.platform_options ?? [],
        correctPlatformIds: result.correct_platform_ids ?? [],
        platformBonusResult: null,
      }));
    } catch (err) {
      set({
        phase: "placing",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  submitPlatformGuess(selectedPlatformIds: number[]) {
    const { correctPlatformIds, platformBonusResult } = get();
    if (platformBonusResult !== null) return;
    const result = checkPlatformGuess(selectedPlatformIds, correctPlatformIds);
    if (result === "correct") {
      set((state) => ({
        score: state.score + 1,
        bonusPointsEarned: state.bonusPointsEarned + 1,
        platformBonusResult: "correct",
      }));
    } else {
      set({ platformBonusResult: "incorrect" });
    }
  },

  advanceTurn() {
    const { lastPlacementCorrect, nextCard } = get();

    if (lastPlacementCorrect === false || nextCard === null) {
      set({ phase: "game_over" });
      return;
    }

    set({
      phase: "placing",
      currentCard: nextCard,
      nextCard: null,
      revealedCard: null,
      lastPlacementCorrect: null,
      validPositions: null,
      availablePlatforms: [],
      correctPlatformIds: [],
      platformBonusResult: null,
    });
  },

  resetGame() {
    set({
      phase: "idle",
      error: null,
      sessionId: null,
      difficulty: null,
      currentCard: null,
      nextCard: null,
      revealedCard: null,
      timelineItems: [],
      score: 0,
      turnsPlayed: 0,
      bestStreak: 0,
      currentStreak: 0,
      bonusPointsEarned: 0,
      bonusOpportunities: 0,
      lastPlacementCorrect: null,
      validPositions: null,
      availablePlatforms: [],
      correctPlatformIds: [],
      platformBonusResult: null,
    });
  },
}));
