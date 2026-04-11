"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { BarChart3, Loader2, RotateCcw, Share2, Trophy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { GameCard } from "@/components/game/GameCard";
import type { TimelineItem } from "@/components/game/Timeline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RevealedCardData } from "@/lib/solo/api";
import {
  buildSoloShareSummary,
  copySoloShareSummary,
  getSoloDifficultyLabel,
} from "@/lib/solo/share";
import type { DifficultyTier } from "@/lib/difficulty";

export type ScoreStatus = "idle" | "submitting" | "saved" | "error";

interface GameOverScreenProps {
  difficulty: DifficultyTier | null;
  score: number;
  turnsPlayed: number;
  bestStreak: number;
  bonusPointsEarned: number;
  bonusOpportunities: number;
  timelineItems: TimelineItem[];
  failedCard: RevealedCardData | null;
  validPositions: number[] | null;
  endedOnIncorrectPlacement: boolean;
  /** null = unauthenticated guest */
  username: string | null;
  scoreStatus: ScoreStatus;
  scoreError?: string | undefined;
  onPlayAgain: () => void;
  onChangeDifficulty: () => void;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-800/80 rounded-2xl border border-white/10 p-4 backdrop-blur">
      <p className="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
        {label}
      </p>
      <p className="text-text-primary mt-2 font-mono text-4xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function describeTimelineSlot(placedCards: TimelineItem[], position: number): string {
  const previousCard = position > 0 ? placedCards[position - 1] : undefined;
  const nextCard = placedCards[position];

  if (previousCard !== undefined && nextCard !== undefined) {
    return `between ${previousCard.title} (${String(previousCard.releaseYear)}) and ${nextCard.title} (${String(nextCard.releaseYear)})`;
  }

  if (previousCard !== undefined) {
    return `after ${previousCard.title} (${String(previousCard.releaseYear)})`;
  }

  if (nextCard !== undefined) {
    return `before ${nextCard.title} (${String(nextCard.releaseYear)})`;
  }

  return "as the first card on the timeline";
}

function SlotPreview({ active, label }: { active: boolean; label: string }) {
  return (
    <div
      className={cn(
        "flex h-24 w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-dashed px-2 text-center",
        active
          ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_18px_rgba(52,211,153,0.25)]"
          : "bg-surface-900/60 border-white/12",
      )}
      aria-label={active ? `Correct slot: ${label}` : `Timeline slot: ${label}`}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn("w-1 rounded-full", active ? "h-12 bg-emerald-400" : "h-8 bg-white/20")}
        />
        <span
          className={cn(
            "text-[10px] font-semibold tracking-[0.18em] uppercase",
            active ? "text-emerald-300" : "text-text-secondary/60",
          )}
        >
          {active ? "Place" : "Slot"}
        </span>
      </div>
    </div>
  );
}

function TimelineCardPreview({ card }: { card: TimelineItem }) {
  return (
    <div className="bg-surface-800/70 flex w-28 shrink-0 flex-col rounded-2xl border border-white/10 p-3">
      <span className="text-primary-300 font-mono text-xs font-semibold tabular-nums">
        {card.releaseYear}
      </span>
      <span className="text-text-primary mt-2 line-clamp-2 text-sm font-medium">{card.title}</span>
    </div>
  );
}

export function GameOverScreen({
  difficulty,
  score,
  turnsPlayed,
  bestStreak,
  bonusPointsEarned,
  bonusOpportunities,
  timelineItems,
  failedCard,
  validPositions,
  endedOnIncorrectPlacement,
  username,
  scoreStatus,
  scoreError,
  onPlayAgain,
  onChangeDifficulty,
}: GameOverScreenProps) {
  const shareSummary = buildSoloShareSummary({
    difficulty,
    score,
    turnsPlayed,
  });
  const highlightedPositions = endedOnIncorrectPlacement ? (validPositions ?? []) : [];
  const positionDescriptions = highlightedPositions.map((position) =>
    describeTimelineSlot(timelineItems, position),
  );
  const firstPositionDescription = positionDescriptions[0];

  return (
    <motion.section
      className="flex min-h-screen w-full items-center justify-center px-4 py-6 md:px-6 md:py-10"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="bg-surface-900/95 w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="grid gap-8 px-4 py-6 md:px-8 md:py-10 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase",
                endedOnIncorrectPlacement
                  ? "bg-rose-500/15 text-rose-300"
                  : "bg-emerald-500/15 text-emerald-300",
              )}
            >
              {endedOnIncorrectPlacement ? "Game Over" : "Deck Cleared"}
            </div>

            {failedCard !== null && (
              <GameCard
                screenshotImageId={failedCard.screenshot_image_ids[0] ?? null}
                coverImageId={failedCard.cover_image_id}
                title={failedCard.name}
                releaseYear={failedCard.release_year}
                platform={failedCard.platform_names[0] ?? "Unknown"}
                isRevealed
                className="w-[68vw] max-w-[260px] md:w-[240px]"
              />
            )}

            <p className="text-text-secondary max-w-xs text-center text-sm">
              {endedOnIncorrectPlacement
                ? "This reveal ended your run. The highlighted slot shows where it belonged."
                : "You placed every card in the deck without missing a turn."}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-text-primary text-4xl font-bold md:text-5xl">
                  {endedOnIncorrectPlacement ? "Game Over" : "Perfect Run"}
                </h2>
                {difficulty !== null && (
                  <span className="border-primary-400/30 bg-primary-500/10 text-primary-300 rounded-full border px-3 py-1 text-xs font-semibold">
                    {getSoloDifficultyLabel(difficulty)}
                  </span>
                )}
              </div>

              <p className="text-text-secondary max-w-2xl text-sm md:text-base">
                {endedOnIncorrectPlacement
                  ? "One wrong placement stopped the endless run, but the board you built is still worth showing off."
                  : "You ran the full solo deck cleanly and closed out the session with a perfect finish."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Final score" value={score} />
              <StatCard label="Turns played" value={turnsPlayed} />
              <StatCard label="Best streak" value={bestStreak} />
            </div>

            {bonusOpportunities > 0 && (
              <div className="bg-surface-800/75 rounded-2xl border border-white/10 p-4">
                <p className="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
                  Platform bonus performance
                </p>
                <p className="text-text-primary mt-2 text-base font-semibold">
                  Platform Bonuses:{" "}
                  <span className="font-mono tabular-nums">
                    {bonusPointsEarned}/{bonusOpportunities}
                  </span>
                </p>
              </div>
            )}

            {endedOnIncorrectPlacement &&
              failedCard !== null &&
              positionDescriptions.length > 0 && (
                <div className="bg-surface-800/75 rounded-2xl border border-white/10 p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="text-primary-300 size-4" aria-hidden="true" />
                    <h3 className="font-display text-text-primary text-lg font-semibold">
                      Correct position
                    </h3>
                  </div>

                  <p className="text-text-secondary mt-2 text-sm">
                    {positionDescriptions.length === 1 && firstPositionDescription !== undefined
                      ? `This card belonged ${firstPositionDescription}.`
                      : "Any highlighted slot would have counted because the release year matched the neighboring cards."}
                  </p>

                  <div className="mt-4 overflow-x-auto pb-1">
                    <div className="inline-flex min-w-full items-center gap-3">
                      <SlotPreview
                        active={highlightedPositions.includes(0)}
                        label={describeTimelineSlot(timelineItems, 0)}
                      />

                      {timelineItems.map((card, index) => (
                        <Fragment key={card.id}>
                          <TimelineCardPreview card={card} />
                          <SlotPreview
                            active={highlightedPositions.includes(index + 1)}
                            label={describeTimelineSlot(timelineItems, index + 1)}
                          />
                        </Fragment>
                      ))}
                    </div>
                  </div>

                  {positionDescriptions.length > 1 && (
                    <div className="text-text-secondary mt-3 flex flex-col gap-1 text-xs">
                      {positionDescriptions.map((description) => (
                        <span key={description}>{description}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

            <div className="bg-surface-800/75 rounded-2xl border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-yellow-400" aria-hidden="true" />
                <h3 className="font-display text-text-primary text-lg font-semibold">
                  Share preview
                </h3>
              </div>
              <pre className="bg-surface-900/80 text-text-primary mt-3 overflow-x-auto rounded-xl p-3 font-mono text-sm break-words whitespace-pre-wrap">
                {shareSummary}
              </pre>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={onPlayAgain} className="sm:flex-1">
                <RotateCcw className="size-4" aria-hidden="true" />
                Play Again
              </Button>
              <Button onClick={onChangeDifficulty} variant="outline" className="sm:flex-1">
                Change Difficulty
              </Button>
              <Button
                onClick={() => {
                  void copySoloShareSummary({
                    clipboard: navigator.clipboard,
                    summary: shareSummary,
                    score,
                    notify: toast,
                  });
                }}
                variant="secondary"
                className="sm:flex-1"
              >
                <Share2 className="size-4" aria-hidden="true" />
                Share Result
              </Button>
            </div>

            {/* Score save status */}
            {username !== null ? (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium",
                  scoreStatus === "saved" &&
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                  scoreStatus === "submitting" &&
                    "border-white/10 bg-surface-800/80 text-text-secondary",
                  scoreStatus === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-300",
                  scoreStatus === "idle" && "border-white/10 bg-surface-800/80 text-text-secondary",
                )}
                role="status"
                aria-live="polite"
              >
                {scoreStatus === "submitting" && (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Saving score…
                  </>
                )}
                {scoreStatus === "saved" && (
                  <>
                    <Trophy className="size-4 text-yellow-400" aria-hidden="true" />
                    Score saved!{" "}
                    <Link href="/leaderboard" className="text-primary-400 hover:underline">
                      View leaderboard →
                    </Link>
                  </>
                )}
                {scoreStatus === "error" && (
                  <>{scoreError ?? "Failed to save score."}</>
                )}
                {scoreStatus === "idle" && <>Preparing to save score…</>}
              </div>
            ) : (
              <Link
                href={`/auth/signup?next=${encodeURIComponent("/play/solo?saved=pending")}`}
                className="bg-primary-500 hover:bg-primary-400 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
              >
                <Trophy className="size-4" aria-hidden="true" />
                Sign up to save your score
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
