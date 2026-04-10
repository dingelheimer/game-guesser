"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/game/GameCard";
import { GameOverScreen } from "@/components/game/GameOverScreen";
import { Timeline } from "@/components/game/Timeline";
import { TitleGuessInput } from "@/components/game/TitleGuessInput";
import { useSoloGameStore } from "@/stores/soloGameStore";
import { hiddenToTimelineItem } from "@/stores/soloGameStore";
import { getSoloDifficultyLabel } from "@/lib/solo/share";
import type { DifficultyTier } from "@/types/supabase";
import { Trophy, Zap } from "lucide-react";

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({
  score,
  streak,
  bestStreak,
  difficulty,
}: {
  score: number;
  streak: number;
  bestStreak: number;
  difficulty: DifficultyTier;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-1.5 font-mono text-lg font-bold text-text-primary">
        <Trophy className="size-4 text-yellow-400" aria-hidden="true" />
        <span aria-label={`Score: ${score.toString()}`}>{score}</span>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Zap className="size-3.5 text-sky-400" aria-hidden="true" />
        <span aria-label={`Current streak: ${streak.toString()}`}>×{streak}</span>
        <span className="text-xs text-text-secondary/60">
          best {bestStreak.toString()}
        </span>
      </div>

      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          difficulty === "easy" && "bg-emerald-500/20 text-emerald-400",
          difficulty === "medium" && "bg-sky-500/20 text-sky-400",
          difficulty === "hard" && "bg-orange-500/20 text-orange-400",
          difficulty === "extreme" && "bg-rose-500/20 text-rose-400",
        )}
        aria-label={`Difficulty: ${getSoloDifficultyLabel(difficulty)}`}
      >
        {getSoloDifficultyLabel(difficulty)}
      </span>
    </div>
  );
}

// ── Result overlay (correct / incorrect indicator) ────────────────────────────

function PlacementResult({ correct }: { correct: boolean }) {
  return (
    <motion.div
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold",
        correct
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-rose-500/15 text-rose-400",
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

// ── Main SoloGame component ───────────────────────────────────────────────────

export function SoloGame() {
  const phase = useSoloGameStore((s) => s.phase);
  const difficulty = useSoloGameStore((s) => s.difficulty);
  const currentCard = useSoloGameStore((s) => s.currentCard);
  const revealedCard = useSoloGameStore((s) => s.revealedCard);
  const timelineItems = useSoloGameStore((s) => s.timelineItems);
  const score = useSoloGameStore((s) => s.score);
  const turnsPlayed = useSoloGameStore((s) => s.turnsPlayed);
  const bestStreak = useSoloGameStore((s) => s.bestStreak);
  const currentStreak = useSoloGameStore((s) => s.currentStreak);
  const lastPlacementCorrect = useSoloGameStore((s) => s.lastPlacementCorrect);
  const validPositions = useSoloGameStore((s) => s.validPositions);
  const titleGuessResult = useSoloGameStore((s) => s.titleGuessResult);
  const error = useSoloGameStore((s) => s.error);

  const placeCard = useSoloGameStore((s) => s.placeCard);
  const submitTitleGuess = useSoloGameStore((s) => s.submitTitleGuess);
  const advanceTurn = useSoloGameStore((s) => s.advanceTurn);
  const resetGame = useSoloGameStore((s) => s.resetGame);

  const reduceMotion = useReducedMotion();

  const isSubmitting = phase === "submitting";
  const isPlacing = phase === "placing" || phase === "submitting";
  const isRevealing = phase === "revealing";

  const pendingTimelineItem =
    isPlacing && currentCard !== null ? hiddenToTimelineItem(currentCard) : null;

  // ── Game over screen ──────────────────────────────────────────────────────

  if (phase === "game_over") {
      return (
        <div className="flex min-h-screen flex-col">
          <GameOverScreen
            difficulty={difficulty}
            score={score}
            turnsPlayed={turnsPlayed}
            bestStreak={bestStreak}
            timelineItems={timelineItems}
            failedCard={revealedCard}
            validPositions={validPositions}
            endedOnIncorrectPlacement={lastPlacementCorrect === false}
            onPlayAgain={() => {
              if (difficulty !== null) {
                void useSoloGameStore.getState().startGame(difficulty);
              } else {
                resetGame();
              }
            }}
            onChangeDifficulty={resetGame}
          />
        </div>
      );
  }

  // ── Active game ───────────────────────────────────────────────────────────

  const gameIdOrNone = (id: number | undefined): string => (id !== undefined ? String(id) : "none");
  const cardKey = isRevealing
    ? `revealed-${gameIdOrNone(revealedCard?.game_id)}`
    : `hidden-${gameIdOrNone(currentCard?.game_id)}`;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Score bar */}
      {difficulty !== null && (
        <ScoreBar
          score={score}
          streak={currentStreak}
          bestStreak={bestStreak}
          difficulty={difficulty}
        />
      )}

      {/* Error banner */}
      {error !== null && (
        <div
          className="bg-rose-500/15 px-4 py-2 text-sm text-rose-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Card area */}
      <div className="flex flex-col items-center gap-4 px-4 pt-6 pb-4">
        <AnimatePresence mode="wait">
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
              isRevealing &&
                lastPlacementCorrect === false &&
                "ring-2 ring-rose-500 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)]",
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
              platform={
                isRevealing ? (revealedCard?.platform_names[0] ?? "Unknown") : "?"
              }
              isRevealed={isRevealing}
              isLoading={isSubmitting}
            />
          </motion.div>
        </AnimatePresence>

        {/* Placement result + title guess + next turn */}
        <AnimatePresence>
          {isRevealing && lastPlacementCorrect !== null && (
            <motion.div
              className="flex w-full max-w-sm flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PlacementResult correct={lastPlacementCorrect} />

              {lastPlacementCorrect && (
                <TitleGuessInput
                  correctTitle={revealedCard?.name ?? ""}
                  result={titleGuessResult}
                  submitted={titleGuessResult !== null}
                  onSubmit={submitTitleGuess}
                />
              )}

              <Button
                onClick={advanceTurn}
                className="w-full max-w-sm"
                aria-label={
                  !lastPlacementCorrect ? "See game over screen" : "Next turn"
                }
              >
                {!lastPlacementCorrect ? "See Result" : "Next Turn →"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <p className="px-4 pb-1 text-xs text-text-secondary/60">
          {isPlacing ? "Tap a zone to place the card" : "Timeline"}
        </p>
        <Timeline
          placedCards={timelineItems}
          pendingCard={pendingTimelineItem}
          {...(isPlacing ? { onPlaceCard: (pos: number) => { void placeCard(pos); } } : {})}
        />
      </div>
    </div>
  );
}
