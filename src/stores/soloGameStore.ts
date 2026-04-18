// SPDX-License-Identifier: AGPL-3.0-only
import { create } from "zustand";
import {
  checkPlatformGuess,
  hiddenToTimelineItem,
  insertAtPosition,
  pickCorrectionTarget,
  revealedToTimelineItem,
} from "./soloGameStore.helpers";
import type { GamePhase, PlatformOption, SoloGameState } from "./soloGameStore.helpers";
import type { DifficultyTier } from "@/lib/difficulty";
import type { HouseRuleParams, LobbySettings } from "@/lib/multiplayer/lobby";
import {
  classifyPlacementOutcome,
  extendShareYearRange,
} from "@/lib/share";
import type { ShareOutcome, ShareYearRange } from "@/lib/share";
import * as api from "@/lib/solo/api";

export type { GamePhase, SoloGameState };
export { checkPlatformGuess, revealedToTimelineItem, hiddenToTimelineItem };
export type { PlatformOption };

export const useSoloGameStore = create<SoloGameState>()((set, get) => ({
  phase: "idle",
  error: null,

  sessionId: null,
  difficulty: null,
  variant: null,
  gameMode: null,
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
  shareOutcomes: [],
  shareYearRange: null,

  lastPlacementCorrect: null,
  validPositions: null,
  availablePlatforms: [],
  correctPlatformIds: [],
  platformBonusResult: null,
  expertVerificationResult: null,
  teamTokens: null,
  teamWinCondition: null,
  referenceCard: null,
  guess: null,

  async startGame(
    difficulty: DifficultyTier,
    houseRules?: HouseRuleParams,
    variant: LobbySettings["variant"] = "standard",
    gameMode: LobbySettings["gameMode"] = "competitive",
    teamWinCondition?: number,
  ) {
    set({ phase: "starting", error: null });
    try {
      const res = await api.startGame(difficulty, houseRules);
      set({
        phase: "placing",
        sessionId: res.session_id,
        difficulty,
        variant,
        gameMode,
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
        shareOutcomes: [],
        shareYearRange: res.timeline.reduce<ShareYearRange | null>(
          (range, card) => extendShareYearRange(range, card.release_year),
          null,
        ),
        lastPlacementCorrect: null,
        validPositions: null,
        availablePlatforms: [],
        correctPlatformIds: [],
        platformBonusResult: null,
        expertVerificationResult: null,
        teamTokens: gameMode === "teamwork" ? 5 : null,
        teamWinCondition: gameMode === "teamwork" ? (teamWinCondition ?? 10) : null,
        referenceCard: variant === "higher_lower" ? (res.timeline[0] ?? null) : null,
        guess: null,
      });
    } catch (err) {
      set({
        phase: "idle",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async placeCard(position: number) {
    const { phase, sessionId, currentCard, timelineItems, variant } = get();
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
      const result = await api.submitTurn(sessionId, position, variant ?? undefined);
      const shareOutcome = classifyPlacementOutcome(
        timelineItems.map((item) => item.releaseYear),
        position,
        result.revealed_card.release_year,
      );
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
        bonusOpportunities: result.correct && variant !== "standard"
          ? state.bonusOpportunities + 1
          : state.bonusOpportunities,
        shareOutcomes: [...state.shareOutcomes, shareOutcome],
        shareYearRange: extendShareYearRange(
          state.shareYearRange,
          result.revealed_card.release_year,
        ),
        lastPlacementCorrect: result.correct,
        validPositions: result.valid_positions ?? null,
        availablePlatforms: result.platform_options ?? [],
        correctPlatformIds: result.correct_platform_ids ?? [],
        platformBonusResult: null,
        expertVerificationResult: null,
        teamTokens:
          state.gameMode === "teamwork" && !result.correct && state.teamTokens !== null
            ? Math.max(0, state.teamTokens - 1)
            : state.teamTokens,
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

  async guessRelation(guess: "higher" | "lower") {
    const { phase, sessionId, currentCard, timelineItems } = get();
    if (phase !== "placing" || sessionId === null || currentCard === null) return;

    set({ phase: "submitting", error: null, guess });

    try {
      const result = await api.submitHigherLowerTurn(sessionId, guess);
      const shareOutcome: ShareOutcome = result.correct ? "correct" : "wrong";
      const newTimelineItems = result.correct
        ? [revealedToTimelineItem(result.revealed_card)]
        : timelineItems;

      set((state) => ({
        phase: "revealing",
        revealedCard: result.revealed_card,
        nextCard: result.next_card ?? null,
        timelineItems: newTimelineItems,
        referenceCard: result.correct ? result.revealed_card : state.referenceCard,
        score: result.score,
        turnsPlayed: result.turns_played,
        bestStreak: result.best_streak,
        currentStreak: result.current_streak,
        shareOutcomes: [...state.shareOutcomes, shareOutcome],
        shareYearRange: extendShareYearRange(
          state.shareYearRange,
          result.revealed_card.release_year,
        ),
        lastPlacementCorrect: result.correct,
        validPositions: null,
        availablePlatforms: [],
        correctPlatformIds: [],
        platformBonusResult: null,
        expertVerificationResult: null,
      }));
    } catch (err) {
      set({
        phase: "placing",
        guess: null,
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
      gameMode,
      lastPlacementCorrect,
      nextCard,
      platformBonusResult,
      score,
      teamTokens,
      teamWinCondition,
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

    if (gameMode === "teamwork") {
      const tokensLeft = teamTokens ?? 0;
      if (tokensLeft <= 0) {
        set({ phase: "game_over" });
        return;
      }
      if (teamWinCondition !== null && score >= teamWinCondition) {
        set({ phase: "game_over" });
        return;
      }
      if (nextCard === null) {
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
      gameMode: null,
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
      shareOutcomes: [],
      shareYearRange: null,
      lastPlacementCorrect: null,
      validPositions: null,
      availablePlatforms: [],
      correctPlatformIds: [],
      platformBonusResult: null,
      expertVerificationResult: null,
      teamTokens: null,
      teamWinCondition: null,
      referenceCard: null,
      guess: null,
    });
  },
}));
