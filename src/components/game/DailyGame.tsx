// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/game/GameCard";
import { DailyGameOverScreen } from "@/components/game/DailyGameOverScreen";
import { Timeline } from "@/components/game/Timeline";
import { useDailyGameStore } from "@/stores/dailyGameStore";
import { hiddenToTimelineItem } from "@/stores/dailyGameStore.helpers";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion";

// ── DailyHUD ──────────────────────────────────────────────────────────────────

interface DailyHUDProps {
  challengeNumber: number | null;
  challengeDate: string | null;
  score: number;
  turnsPlayed: number;
  totalCards: number;
  extraTryAvailable: boolean;
}

function DailyHUD({
  challengeNumber,
  challengeDate,
  score,
  turnsPlayed,
  totalCards,
  extraTryAvailable,
}: DailyHUDProps) {
  const formattedDate =
    challengeDate !== null
      ? new Date(challengeDate + "T12:00:00").toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <div className="bg-surface-800/80 flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 backdrop-blur-xl">
      {/* Challenge header */}
      <div className="text-text-primary text-sm font-semibold">
        {challengeNumber !== null ? (
          <>
            <span className="text-sky-400">Daily #{challengeNumber}</span>
            {formattedDate !== null && (
              <span className="text-text-secondary ml-2 text-xs font-normal">{formattedDate}</span>
            )}
          </>
        ) : (
          <span className="text-sky-400">Daily Challenge</span>
        )}
      </div>

      {/* Progress + extra try */}
      <div className="flex items-center gap-3">
        <span
          className="text-text-secondary text-xs font-medium"
          aria-label={`Card ${String(turnsPlayed + 1)} of ${String(totalCards)}`}
        >
          Card {turnsPlayed + 1}/{totalCards}
        </span>

        <span
          className="text-base leading-none"
          aria-label={extraTryAvailable ? "Extra try available" : "Extra try used"}
          title={extraTryAvailable ? "Extra try available" : "Extra try used"}
        >
          {extraTryAvailable ? "❤️" : "🖤"}
        </span>

        <span
          className="text-text-primary font-mono text-sm font-bold tabular-nums"
          aria-label={`Score: ${String(score)}`}
        >
          {score}/{totalCards}
        </span>
      </div>
    </div>
  );
}

// ── DailyResultControls ───────────────────────────────────────────────────────

interface DailyResultControlsProps {
  show: boolean;
  correct: boolean;
  /** Whether the extra try is still available after this turn. */
  extraTryAvailable: boolean;
  /** Whether this turn ended the game. */
  gameOver: boolean;
  onAdvanceTurn: () => void;
}

function DailyResultControls({
  show,
  correct,
  extraTryAvailable,
  gameOver,
  onAdvanceTurn,
}: DailyResultControlsProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (show) divRef.current?.focus();
  }, [show]);

  const message = correct
    ? "✓ Correct!"
    : gameOver
      ? "✗ Wrong placement"
      : !extraTryAvailable
        ? "✗ Card discarded — extra try used"
        : "✗ Wrong placement";

  const buttonLabel = gameOver ? "See Result" : "Next Turn →";

  return (
    <>
      {/* Always-present live region for screen readers. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {show ? message : ""}
      </div>

      <AnimatePresence>
        {show && (
          <motion.div
            ref={divRef}
            tabIndex={-1}
            className="flex w-full max-w-lg flex-col items-center gap-3 focus:outline-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold",
                correct ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
              )}
              initial={reduceMotion === true ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={reduceMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: MOTION.duration.fast }}
            >
              {message}
            </motion.div>

            <Button onClick={onAdvanceTurn} className="w-full max-w-sm" aria-label={buttonLabel}>
              {buttonLabel}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── DailyGame ─────────────────────────────────────────────────────────────────

/** Renders the daily challenge play surface: HUD, hero card, result controls, and timeline. */
export function DailyGame() {
  const phase = useDailyGameStore((s) => s.phase);
  const challengeNumber = useDailyGameStore((s) => s.challengeNumber);
  const challengeDate = useDailyGameStore((s) => s.challengeDate);
  const currentCard = useDailyGameStore((s) => s.currentCard);
  const revealedCard = useDailyGameStore((s) => s.revealedCard);
  const timelineItems = useDailyGameStore((s) => s.timelineItems);
  const score = useDailyGameStore((s) => s.score);
  const turnsPlayed = useDailyGameStore((s) => s.turnsPlayed);
  const totalCards = useDailyGameStore((s) => s.totalCards);
  const extraTryAvailable = useDailyGameStore((s) => s.extraTryAvailable);
  const lastPlacementCorrect = useDailyGameStore((s) => s.lastPlacementCorrect);
  const gameOver = useDailyGameStore((s) => s.gameOver);
  const placements = useDailyGameStore((s) => s.placements);
  const revealedCards = useDailyGameStore((s) => s.revealedCards);
  const error = useDailyGameStore((s) => s.error);
  const streak = useDailyGameStore((s) => s.streak);

  const placeCard = useDailyGameStore((s) => s.placeCard);
  const advanceTurn = useDailyGameStore((s) => s.advanceTurn);
  const resetGame = useDailyGameStore((s) => s.resetGame);

  const reduceMotion = useReducedMotion();
  const timelineWrapperRef = useRef<HTMLDivElement>(null);

  const isPlacing = phase === "placing";
  const isRevealing = phase === "revealing";
  const isSubmitting = phase === "submitting";
  const isIncorrectReveal = isRevealing && lastPlacementCorrect === false;

  const pendingTimelineItem =
    isPlacing && currentCard !== null ? hiddenToTimelineItem(currentCard) : null;
  const shouldShowHeroCard = !isSubmitting && (isRevealing || currentCard !== null);
  const shouldShowResultControls = isRevealing && lastPlacementCorrect !== null;

  // Move focus to the timeline wrapper when placing starts so keyboard users
  // can Tab directly to the first drop zone.
  useEffect(() => {
    if (isPlacing) {
      timelineWrapperRef.current?.focus();
    }
  }, [isPlacing]);

  if (phase === "game_over") {
    return (
      <DailyGameOverScreen
        challengeNumber={challengeNumber}
        challengeDate={challengeDate}
        score={score}
        totalCards={totalCards}
        turnsPlayed={turnsPlayed}
        extraTryUsed={!extraTryAvailable}
        placements={placements}
        revealedCards={revealedCards}
        streak={streak}
        onPlayAgain={resetGame}
      />
    );
  }

  const cardKey = isRevealing
    ? `revealed-${String(revealedCard?.game_id ?? "none")}`
    : `hidden-${String(currentCard?.game_id ?? "none")}`;

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Daily HUD */}
      <DailyHUD
        challengeNumber={challengeNumber}
        challengeDate={challengeDate}
        score={score}
        turnsPlayed={turnsPlayed}
        totalCards={totalCards}
        extraTryAvailable={extraTryAvailable}
      />

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
                isIncorrectReveal && reduceMotion !== true
                  ? { x: [0, -10, 10, -8, 8, -4, 4, 0], opacity: 1, y: 0 }
                  : { opacity: 1, y: 0 }
              }
              exit={reduceMotion === true ? {} : { opacity: 0, y: -12 }}
              transition={
                isIncorrectReveal
                  ? { duration: MOTION.duration.slow }
                  : { duration: MOTION.duration.fast }
              }
              className={cn(
                "relative",
                isPlacing && "md:hidden",
                isIncorrectReveal &&
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
                platform={isRevealing ? (revealedCard?.platform_names[0] ?? "Unknown") : "?"}
                isRevealed={isRevealing}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Placement result + next turn control */}
        <DailyResultControls
          show={shouldShowResultControls}
          correct={lastPlacementCorrect ?? false}
          extraTryAvailable={extraTryAvailable}
          gameOver={gameOver}
          onAdvanceTurn={advanceTurn}
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
            {isPlacing ? "Timeline — tap a zone to place" : "Timeline"}
          </span>
          <div className="bg-surface-700 h-px flex-1" />
        </div>
        <Timeline
          placedCards={timelineItems}
          pendingCard={pendingTimelineItem}
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
