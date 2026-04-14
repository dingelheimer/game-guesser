"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/game/GameCard";
import { GameOverScreen } from "@/components/game/GameOverScreen";
import type { ScoreStatus } from "@/components/game/GameOverScreen";
import { PlatformBonusInput } from "@/components/game/PlatformBonusInput";
import { ScoreBar } from "@/components/game/ScoreBar";
import { Timeline } from "@/components/game/Timeline";
import { useSoloGameStore } from "@/stores/soloGameStore";
import { hiddenToTimelineItem } from "@/stores/soloGameStore";
import { submitScoreAction } from "@/lib/auth/actions";

function PlacementResult({ correct }: { correct: boolean }) {
  return (
    <motion.div
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold",
        correct ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
      )}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
    >
      {correct ? "✓ Correct!" : "✗ Wrong placement"}
    </motion.div>
  );
}

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
  const lastPlacementCorrect = useSoloGameStore((s) => s.lastPlacementCorrect);
  const validPositions = useSoloGameStore((s) => s.validPositions);
  const availablePlatforms = useSoloGameStore((s) => s.availablePlatforms);
  const correctPlatformIds = useSoloGameStore((s) => s.correctPlatformIds);
  const platformBonusResult = useSoloGameStore((s) => s.platformBonusResult);
  const error = useSoloGameStore((s) => s.error);

  const placeCard = useSoloGameStore((s) => s.placeCard);
  const moveCardToCorrectPosition = useSoloGameStore((s) => s.moveCardToCorrectPosition);
  const revealMovedCard = useSoloGameStore((s) => s.revealMovedCard);
  const advanceTurn = useSoloGameStore((s) => s.advanceTurn);
  const resetGame = useSoloGameStore((s) => s.resetGame);
  const submitPlatformGuess = useSoloGameStore((s) => s.submitPlatformGuess);

  const reduceMotion = useReducedMotion();
  const [incorrectPlacementStage, setIncorrectPlacementStage] =
    useState<IncorrectPlacementStage>("idle");

  // Track which sessionId we've already submitted a score for (prevents double-submit)
  const submittedSessionRef = useRef<string | null>(null);
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>("idle");
  const [scoreError, setScoreError] = useState<string | undefined>(undefined);

  const isSubmitting = phase === "submitting";
  const isPlacing = phase === "placing";
  const isRevealing = phase === "revealing";
  const isProVariant = variant === "pro";
  const isIncorrectReveal = isRevealing && lastPlacementCorrect === false;
  const isPlatformBonusPending =
    isRevealing &&
    lastPlacementCorrect === true &&
    availablePlatforms.length > 0 &&
    platformBonusResult === null;

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
      void submitScoreAction(score, bestStreak).then((result) => {
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
        JSON.stringify({ score, streak: bestStreak, timestamp: Date.now() }),
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
  const revealedPlatform = isPlatformBonusPending
    ? ""
    : (revealedCard?.platform_names[0] ?? "Unknown");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col">
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

      {/* Error banner */}
      {error !== null && (
        <div className="bg-rose-500/15 px-4 py-2 text-sm text-rose-400" role="alert">
          {error}
        </div>
      )}

      {/* Card area */}
      <div
        className={cn(
          "flex flex-col items-center gap-6 px-4 pt-6 pb-4",
          isPlacing && "md:gap-0 md:pt-0 md:pb-0",
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
                  ? { duration: 0.5 }
                  : { duration: 0.25 }
              }
              className={cn(
                "relative",
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
        <AnimatePresence>
          {shouldShowResultControls && (
            <motion.div
              className="flex w-full max-w-lg flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PlacementResult correct={lastPlacementCorrect} />

              {lastPlacementCorrect && availablePlatforms.length > 0 && (
                <div className="w-full space-y-2">
                  {isProVariant ? (
                    <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-100">
                      <strong>PRO Required:</strong> answer the platform bonus correctly to keep
                      this card.
                    </div>
                  ) : null}
                  <PlatformBonusInput
                    platforms={availablePlatforms}
                    correctPlatformIds={correctPlatformIds}
                    result={platformBonusResult}
                    onSubmit={submitPlatformGuess}
                  />
                </div>
              )}

              <Button
                onClick={advanceTurn}
                className="w-full max-w-sm"
                aria-label={!lastPlacementCorrect ? "See game over screen" : "Next turn"}
                disabled={isProVariant && isPlatformBonusPending}
              >
                {!lastPlacementCorrect ? "See Result" : "Next Turn →"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-3 px-4 pt-1 pb-2">
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
                  void placeCard(pos);
                },
              }
            : {})}
        />
      </div>
    </div>
  );
}
