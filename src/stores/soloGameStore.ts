import { create } from "zustand";
import Fuse from "fuse.js";
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

export function checkTitleGuess(guess: string, correctTitle: string): "correct" | "incorrect" {
  const fuse = new Fuse([{ title: correctTitle }], {
    keys: ["title"],
    threshold: 0.4,
  });
  return fuse.search(guess).length > 0 ? "correct" : "incorrect";
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

  /** Result of the last placement. null during placing/submitting. */
  lastPlacementCorrect: boolean | null;
  /** Valid insertion indices returned when placement is incorrect. */
  validPositions: number[] | null;

  titleGuessResult: "correct" | "incorrect" | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  startGame: (difficulty: DifficultyTier) => Promise<void>;
  placeCard: (position: number) => Promise<void>;
  submitTitleGuess: (guess: string) => void;
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

  lastPlacementCorrect: null,
  validPositions: null,
  titleGuessResult: null,

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
        lastPlacementCorrect: null,
        validPositions: null,
        titleGuessResult: null,
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

      set({
        phase: "revealing",
        revealedCard: result.revealed_card,
        nextCard: result.next_card ?? null,
        timelineItems: newTimelineItems,
        score: result.score,
        turnsPlayed: result.turns_played,
        bestStreak: result.best_streak,
        currentStreak: result.current_streak,
        lastPlacementCorrect: result.correct,
        validPositions: result.valid_positions ?? null,
        titleGuessResult: null,
      });
    } catch (err) {
      set({
        phase: "placing",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  submitTitleGuess(guess: string) {
    const { revealedCard } = get();
    if (revealedCard === null || guess.trim() === "") return;
    set({ titleGuessResult: checkTitleGuess(guess, revealedCard.name) });
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
      titleGuessResult: null,
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
      lastPlacementCorrect: null,
      validPositions: null,
      titleGuessResult: null,
    });
  },
}));
