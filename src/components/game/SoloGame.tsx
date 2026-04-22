// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GameCard } from "@/components/game/GameCard";
import { GameOverScreen } from "@/components/game/GameOverScreen";
import type { ScoreStatus } from "@/components/game/GameOverScreen";
import { ScoreBar } from "@/components/game/ScoreBar";
import { SoloResultControls } from "@/components/game/SoloResultControls";
import { Timeline } from "@/components/game/Timeline";
import { useSoloGameStore } from "@/stores/soloGameStore";
import { hiddenToTimelineItem } from "@/stores/soloGameStore";
import { submitScoreAction } from "@/lib/auth/actions";
import { MOTION } from "@/lib/motion";

type IncorrectPlacementStage = "idle" | "indicator" | "sliding" | "revealing" | "done";

/** Renders the solo game play surface, including the hero card, result controls, and timeline. */
export function SoloGame({ username }: { username: string | null }) {
  const phase = useSoloGameStore((s) => s.phase);
  const difficulty = useSoloGameStore((s) => s.difficulty);
  const variant = useSoloGameStore((s) => s.variant);
  const sessionId = useSoloGameStore((s) => s.sessionId);
  const houseRules = useSoloGameStore((s) => s.houseRules);
  const currentCard = useSoloGameStore((s) => s.currentCard);
  const revealedCard = useSoloGameStore((s) => s.revealedCard);
  const timelineItems = useSoloGameStore((s) => s.timelineItems);
  const score = useSoloGameStore((s) => s.score);
  const turnsPlayed = useSoloGameStore((s) => s.turnsPlayed);
  const bestStreak = useSoloGameStore((s) => s.bestStreak);
  const currentStreak = useSoloGameStore((s) => s.currentStreak);
  const bonusPointsEarned = useSoloGameStore((s) => s.bonusPointsEarned);
  const bonusOpportunities = useSoloGameStore((s) => s.bonusOpportunities);
  const shareOutcomes = useSoloGameStore((s) => s.shareOutcomes);
  const shareYearRange = useSoloGameStore((s) => s.shareYearRange);
  const lastPlacementCorrect = useSoloGameStore((s) => s.lastPlacementCorrect);
  const validPositions = useSoloGameStore((s) => s.validPositions);
  const availablePlatforms = useSoloGameStore((s) => s.availablePlatforms);
  const correctPlatformIds = useSoloGameStore((s) => s.correctPlatformIds);
  const platformBonusResult = useSoloGameStore((s) => s.platformBonusResult);
  const expertVerificationResult = useSoloGameStore((s) => s.expertVerificationResult);
  const error = useSoloGameStore((s) => s.error);

  const placeCard = useSoloGameStore((s) => s.placeCard);
  const guessRelation = useSoloGameStore((s) => s.guessRelation);
  const moveCardToCorrectPosition = useSoloGameStore((s) => s.moveCardToCorrectPosition);
  const revealMovedCard = useSoloGameStore((s) => s.revealMovedCard);
  const advanceTurn = useSoloGameStore((s) => s.advanceTurn);
  const resetGame = useSoloGameStore((s) => s.resetGame);
  const submitPlatformGuess = useSoloGameStore((s) => s.submitPlatformGuess);
  const submitExpertVerification = useSoloGameStore((s) => s.submitExpertVerification);
  const gameMode = useSoloGameStore((s) => s.gameMode);
  const teamTokens = useSoloGameStore((s) => s.teamTokens);

  const reduceMotion = useReducedMotion();
  const [incorrectPlacementStage, setIncorrectPlacementStage] =
    useState<IncorrectPlacementStage>("idle");

  // Focus management refs for keyboard navigation
  const timelineWrapperRef = useRef<HTMLDivElement>(null);

  // Track which sessionId we've already submitted a score for (prevents double-submit)
  const submittedSessionRef = useRef<string | null>(null);
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>("idle");
  const [scoreError, setScoreError] = useState<string | undefined>(undefined);

  const isSubmitting = phase === "submitting";
  const isPlacing = phase === "placing";
  const isRevealing = phase === "revealing";
  const isProVariant = variant === "pro";
  const isExpertVariant = variant === "expert";
  const isHigherLower = variant === "higher_lower";
  const isTeamworkMode = gameMode === "teamwork";
  const isIncorrectReveal = isRevealing && lastPlacementCorrect === false;
  const isPlatformBonusPending =
    isRevealing &&
    lastPlacementCorrect === true &&
    availablePlatforms.length > 0 &&
    platformBonusResult === null &&
    !isExpertVariant;
  const isExpertVerificationPending =
    isRevealing &&
    lastPlacementCorrect === true &&
    availablePlatforms.length > 0 &&
    expertVerificationResult === null &&
    isExpertVariant;

  const pendingTimelineItem =
    isPlacing && currentCard !== null ? hiddenToTimelineItem(currentCard) : null;
  const shouldShowHeroCard = !isSubmitting && (isRevealing || currentCard !== null);
  const shouldShowResultControls =
    isRevealing &&
    lastPlacementCorrect !== null &&
    (lastPlacementCorrect || incorrectPlacementStage === "done");

  // Auto-submit score when game ends; save to sessionStorage for guests
  useEffect(() => {
    if (phase !== "game_over" || sessionId === null) return;
    if (submittedSessionRef.current === sessionId) return;
    submittedSessionRef.current = sessionId;

    if (username !== null) {
      setScoreStatus("submitting");
      void submitScoreAction(score, bestStreak, difficulty, variant).then((result) => {
        if ("success" in result) {
          setScoreStatus("saved");
        } else {
          setScoreStatus("error");
          setScoreError(result.error);
        }
      });
    } else {
      // Guest: persist score for post-signup submission
      sessionStorage.setItem(
        "pending_score",
        JSON.stringify({
          score,
          streak: bestStreak,
          difficulty: difficulty ?? null,
          variant: variant ?? null,
          timestamp: Date.now(),
        }),
      );
    }
  }, [phase, sessionId, score, bestStreak, username]);

  // Reset score status when a new game session starts
  useEffect(() => {
    if (phase === "starting") {
      setScoreStatus("idle");
      setScoreError(undefined);
    }
  }, [phase]);

  // Move focus to the timeline wrapper when placing starts so keyboard users
  // can Tab directly to the first drop zone
  useEffect(() => {
    if (isPlacing) {
      timelineWrapperRef.current?.focus();
    }
  }, [isPlacing]);

  useEffect(() => {
    if (!isIncorrectReveal || revealedCard === null) {
      setIncorrectPlacementStage("idle");
      return;
    }

    if (reduceMotion === true) {
      moveCardToCorrectPosition();
      revealMovedCard();
      setIncorrectPlacementStage("done");
      return;
    }

    setIncorrectPlacementStage("indicator");

    const slideTimer = window.setTimeout(() => {
      setIncorrectPlacementStage("sliding");
      moveCardToCorrectPosition();
    }, 400);
    const revealTimer = window.setTimeout(() => {
      setIncorrectPlacementStage("revealing");
      revealMovedCard();
    }, 700);
    const resultTimer = window.setTimeout(() => {
      setIncorrectPlacementStage("done");
    }, 1300);

    return () => {
      window.clearTimeout(slideTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(resultTimer);
    };
  }, [
    isIncorrectReveal,
    moveCardToCorrectPosition,
    reduceMotion,
    revealMovedCard,
    revealedCard?.game_id,
  ]);

  if (phase === "game_over") {
    return (
      <GameOverScreen
        difficulty={difficulty}
        score={score}
        turnsPlayed={turnsPlayed}
        bestStreak={bestStreak}
        bonusPointsEarned={bonusPointsEarned}
        bonusOpportunities={bonusOpportunities}
        shareOutcomes={shareOutcomes}
        shareYearRange={shareYearRange}
        timelineItems={timelineItems}
        failedCard={revealedCard}
        validPositions={validPositions}
        endedOnIncorrectPlacement={lastPlacementCorrect === false}
        username={username}
        scoreStatus={scoreStatus}
        scoreError={scoreError}
        onPlayAgain={() => {
          if (difficulty !== null) {
            void useSoloGameStore
              .getState()
              .startGame(difficulty, houseRules ?? undefined, variant ?? "standard");
          } else {
            resetGame();
          }
        }}
        onChangeDifficulty={resetGame}
      />
    );
  }

  const gameIdOrNone = (id: number | undefined): string => (id !== undefined ? String(id) : "none");
  const cardKey = isRevealing
    ? `revealed-${gameIdOrNone(revealedCard?.game_id)}`
    : `hidden-${gameIdOrNone(currentCard?.game_id)}`;
  const revealedPlatform =
    isPlatformBonusPending || isExpertVerificationPending
      ? ""
      : (revealedCard?.platform_names[0] ?? "Unknown");

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Score bar */}
      {difficulty !== null && (
        <ScoreBar
          score={score}
          streak={currentStreak}
          bestStreak={bestStreak}
          difficulty={difficulty}
          bonusPointsEarned={bonusPointsEarned}
        />
      )}

      {/* TEAMWORK lives counter */}
      {isTeamworkMode && teamTokens !== null && (
        <div className="flex items-center justify-center gap-2 border-b border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          <span className="font-semibold">Lives:</span>
          <span className="tracking-wide">
            {"❤️".repeat(Math.max(0, teamTokens))}
            {"🖤".repeat(Math.max(0, 5 - teamTokens))}
          </span>
          <span className="ml-1 text-rose-300/70">({teamTokens} remaining)</span>
        </div>
      )}

      {/* Error banner */}
      {error !== null && (
        <div className="bg-rose-500/15 px-4 py-2 text-sm text-rose-400" role="alert">
          {error}
        </div>
      )}

      {/* Card area */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 pt-6 pb-4",
          isPlacing && "md:hidden",
        )}
      >
        <AnimatePresence mode="wait">
          {shouldShowHeroCard && (
            <motion.div
              key={cardKey}
              initial={reduceMotion === true ? {} : { opacity: 0, y: 12 }}
              animate={
                isRevealing && lastPlacementCorrect === false && reduceMotion !== true
                  ? { x: [0, -10, 10, -8, 8, -4, 4, 0], opacity: 1, y: 0 }
                  : { opacity: 1, y: 0 }
              }
              exit={reduceMotion === true ? {} : { opacity: 0, y: -12 }}
              transition={
                isRevealing && lastPlacementCorrect === false
                  ? { duration: MOTION.duration.slow }
                  : { duration: MOTION.duration.fast }
              }
              className={cn(
                "relative w-[80vw] shrink-0 md:w-[440px] lg:w-[540px] xl:w-[620px]",
                // Desktop dragging uses the timeline card; mobile still relies on the hero card.
                isPlacing && "md:hidden",
                isRevealing &&
                  lastPlacementCorrect === false &&
                  "rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] ring-2 ring-rose-500",
              )}
            >
              <GameCard
                screenshotImageId={
                  isRevealing
                    ? (revealedCard?.screenshot_image_ids[0] ?? null)
                    : (currentCard?.screenshot_image_ids[0] ?? null)
                }
                coverImageId={isRevealing ? (revealedCard?.cover_image_id ?? null) : null}
                title={isRevealing ? (revealedCard?.name ?? "?") : "?"}
                releaseYear={isRevealing ? (revealedCard?.release_year ?? 0) : 0}
                platform={isRevealing ? revealedPlatform : "?"}
                isRevealed={isRevealing}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Placement result + platform bonus + next turn */}
        <SoloResultControls
          show={shouldShowResultControls}
          correct={lastPlacementCorrect ?? false}
          revealedCard={revealedCard}
          timelineItems={timelineItems}
          availablePlatforms={availablePlatforms}
          correctPlatformIds={correctPlatformIds}
          platformBonusResult={platformBonusResult}
          expertVerificationResult={expertVerificationResult}
          isProVariant={isProVariant}
          isExpertVariant={isExpertVariant}
          isTeamworkMode={isTeamworkMode}
          onAdvanceTurn={advanceTurn}
          onSubmitPlatformGuess={submitPlatformGuess}
          onSubmitExpertVerification={submitExpertVerification}
        />
      </div>

      {/* Timeline */}
      <div
        ref={timelineWrapperRef}
        tabIndex={-1}
        className={cn(
          "flex min-w-0 flex-1 flex-col focus:outline-none",
          !isPlacing && "justify-end",
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pt-1 pb-2">
          <div className="bg-surface-700 h-px flex-1" />
          <span className="text-text-secondary/70 text-xs font-medium tracking-wider uppercase">
            {phase === "placing" ? "Timeline — tap a zone to place" : "Timeline"}
          </span>
          <div className="bg-surface-700 h-px flex-1" />
        </div>
        <Timeline
          placedCards={timelineItems}
          pendingCard={pendingTimelineItem}
          highlightedCardId={
            isIncorrectReveal && incorrectPlacementStage === "indicator" && revealedCard !== null
              ? String(revealedCard.game_id)
              : null
          }
          highlightedCardTone={
            isIncorrectReveal && incorrectPlacementStage === "indicator" ? "error" : null
          }
          {...(isPlacing
            ? {
                onPlaceCard: (pos: number) => {
                  if (isHigherLower) {
                    // Position 0 (left of reference) = "lower"; position 1 (right) = "higher"
                    void guessRelation(pos === 0 ? "lower" : "higher");
                  } else {
                    void placeCard(pos);
                  }
                },
              }
            : {})}
        />
      </div>
    </div>
  );
}
