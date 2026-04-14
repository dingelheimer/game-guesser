import { create } from "zustand";
import type { DifficultyTier } from "@/lib/difficulty";
import { checkPlatformGuess, type PlatformOption } from "@/lib/platformBonus";
import type { TimelineItem } from "@/components/game/Timeline";
import * as api from "@/lib/solo/api";
import type { HiddenCardData, RevealedCardData } from "@/lib/solo/api";
import type { HouseRuleParams, LobbySettings } from "@/lib/multiplayer/lobby";

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

function pickCorrectionTarget(validPositions: readonly number[], droppedPosition: number): number {
  const firstValidPosition = validPositions[0];
  if (firstValidPosition === undefined) return droppedPosition;

  return validPositions.reduce((bestPosition, candidatePosition) => {
    const bestDistance = Math.abs(bestPosition - droppedPosition);
    const candidateDistance = Math.abs(candidatePosition - droppedPosition);

    if (candidateDistance < bestDistance) return candidatePosition;
    if (candidateDistance === bestDistance) return Math.min(bestPosition, candidatePosition);
    return bestPosition;
  }, firstValidPosition);
}

export { checkPlatformGuess };
export type { PlatformOption };

// ── Store interface ───────────────────────────────────────────────────────────

export interface SoloGameState {
  phase: GamePhase;
  error: string | null;

  sessionId: string | null;
  difficulty: DifficultyTier | null;
  variant: LobbySettings["variant"] | null;
  /** Active house rules for the current or last game. */
  houseRules: HouseRuleParams | null;

  /** The card the player is currently placing (hidden — screenshot only). */
  currentCard: HiddenCardData | null;
  /** Queued next card, available after a correct turn. */
  nextCard: HiddenCardData | null;
  /** The card shown after reveal (correct or incorrect). */
  revealedCard: RevealedCardData | null;

  timelineItems: TimelineItem[];
  /** Position where the current card was last dropped. */
  droppedPosition: number | null;
  /** Target position for incorrect-placement slide animation. */
  correctionTargetPosition: number | null;

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
  /** Result of the expert verification round. null until submitted. */
  expertVerificationResult: "correct" | "incorrect" | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  startGame: (
    difficulty: DifficultyTier,
    houseRules?: HouseRuleParams,
    variant?: LobbySettings["variant"],
  ) => Promise<void>;
  placeCard: (position: number) => Promise<void>;
  moveCardToCorrectPosition: () => void;
  revealMovedCard: () => void;
  submitPlatformGuess: (selectedPlatformIds: number[]) => void;
  submitExpertVerification: (yearGuess: number, selectedPlatformIds: number[]) => void;
  advanceTurn: () => void;
  resetGame: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSoloGameStore = create<SoloGameState>()((set, get) => ({
  phase: "idle",
  error: null,

  sessionId: null,
  difficulty: null,
  variant: null,
  houseRules: null,

  currentCard: null,
  nextCard: null,
  revealedCard: null,

  timelineItems: [],
  droppedPosition: null,
  correctionTargetPosition: null,

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
  expertVerificationResult: null,

  async startGame(
    difficulty: DifficultyTier,
    houseRules?: HouseRuleParams,
    variant: LobbySettings["variant"] = "standard",
  ) {
    set({ phase: "starting", error: null });
    try {
      const res = await api.startGame(difficulty, houseRules);
      set({
        phase: "placing",
        sessionId: res.session_id,
        difficulty,
        variant,
        houseRules: houseRules ?? null,
        currentCard: res.current_card,
        nextCard: null,
        revealedCard: null,
        timelineItems: res.timeline.map(revealedToTimelineItem),
        droppedPosition: null,
        correctionTargetPosition: null,
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
        expertVerificationResult: null,
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
      const result = await api.submitTurn(sessionId, position);
      const correctionTargetPosition = result.correct
        ? null
        : pickCorrectionTarget(result.valid_positions ?? [], position);

      const newTimelineItems = result.correct
        ? tentativeTimelineItems.map((item, index) =>
            index === position ? revealedToTimelineItem(result.revealed_card) : item,
          )
        : tentativeTimelineItems;

      set((state) => ({
        phase: "revealing",
        revealedCard: result.revealed_card,
        nextCard: result.next_card ?? null,
        timelineItems: newTimelineItems,
        droppedPosition: position,
        correctionTargetPosition,
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
        expertVerificationResult: null,
      }));
    } catch (err) {
      set({
        phase: "placing",
        timelineItems,
        droppedPosition: null,
        correctionTargetPosition: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  moveCardToCorrectPosition() {
    const { droppedPosition, correctionTargetPosition, timelineItems } = get();

    if (
      droppedPosition === null ||
      correctionTargetPosition === null ||
      droppedPosition === correctionTargetPosition
    ) {
      return;
    }

    const movingCard = timelineItems[droppedPosition];
    if (movingCard === undefined) return;

    const timelineWithoutMovingCard = timelineItems.filter((_, index) => index !== droppedPosition);

    set({
      timelineItems: insertAtPosition(
        timelineWithoutMovingCard,
        movingCard,
        correctionTargetPosition,
      ),
      droppedPosition: correctionTargetPosition,
    });
  },

  revealMovedCard() {
    const { revealedCard, timelineItems, droppedPosition, correctionTargetPosition } = get();
    if (revealedCard === null) return;

    const revealPosition = correctionTargetPosition ?? droppedPosition;
    if (revealPosition === null) return;

    set({
      timelineItems: timelineItems.map((item, index) =>
        index === revealPosition ? revealedToTimelineItem(revealedCard) : item,
      ),
      droppedPosition: revealPosition,
      correctionTargetPosition: null,
    });
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

  submitExpertVerification(yearGuess: number, selectedPlatformIds: number[]) {
    const { correctPlatformIds, expertVerificationResult, revealedCard } = get();
    if (expertVerificationResult !== null || revealedCard === null) return;

    const yearCorrect = yearGuess === revealedCard.release_year;
    const result = checkPlatformGuess(selectedPlatformIds, correctPlatformIds);
    const allCorrect = yearCorrect && result === "correct";
    if (allCorrect) {
      set((state) => ({
        score: state.score + 1,
        bonusPointsEarned: state.bonusPointsEarned + 1,
        expertVerificationResult: "correct",
      }));
    } else {
      set({ expertVerificationResult: "incorrect" });
    }
  },

  advanceTurn() {
    const {
      availablePlatforms,
      expertVerificationResult,
      lastPlacementCorrect,
      nextCard,
      platformBonusResult,
      variant,
    } = get();

    if (
      variant === "pro" &&
      lastPlacementCorrect === true &&
      availablePlatforms.length > 0 &&
      platformBonusResult === null
    ) {
      return;
    }

    if (
      variant === "expert" &&
      lastPlacementCorrect === true &&
      availablePlatforms.length > 0 &&
      expertVerificationResult === null
    ) {
      return;
    }

    if (
      lastPlacementCorrect === false ||
      nextCard === null ||
      (variant === "pro" && platformBonusResult === "incorrect") ||
      (variant === "expert" && expertVerificationResult === "incorrect")
    ) {
      set({ phase: "game_over" });
      return;
    }

    set({
      phase: "placing",
      currentCard: nextCard,
      nextCard: null,
      revealedCard: null,
      droppedPosition: null,
      correctionTargetPosition: null,
      lastPlacementCorrect: null,
      validPositions: null,
      availablePlatforms: [],
      correctPlatformIds: [],
      platformBonusResult: null,
      expertVerificationResult: null,
    });
  },

  resetGame() {
    set({
      phase: "idle",
      error: null,
      sessionId: null,
      difficulty: null,
      variant: null,
      currentCard: null,
      nextCard: null,
      revealedCard: null,
      timelineItems: [],
      droppedPosition: null,
      correctionTargetPosition: null,
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
      expertVerificationResult: null,
    });
  },
}));
