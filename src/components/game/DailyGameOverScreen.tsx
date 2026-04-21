// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { coverUrl } from "@/lib/igdb/images";
import type { DailyPlacementRecord, RevealedCardData } from "@/lib/daily/api";
import { buildPlacementReviewItems } from "@/stores/dailyGameStore.helpers";

// ── Placement row ─────────────────────────────────────────────────────────────

interface PlacementRowProps {
  index: number;
  correct: boolean;
  extraTry: boolean;
  cardData: RevealedCardData | null;
}

function PlacementRow({ index, correct, extraTry, cardData }: PlacementRowProps) {
  const hasCover = cardData !== null && cardData.cover_image_id !== "";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2",
        correct ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5",
      )}
    >
      {/* Index */}
      <span
        className="text-text-secondary w-5 shrink-0 text-center font-mono text-xs font-semibold tabular-nums"
        aria-hidden="true"
      >
        {index}
      </span>

      {/* Cover thumbnail */}
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
        {hasCover ? (
          <Image
            src={coverUrl(cardData.cover_image_id)}
            alt={`Cover art for ${cardData.name}`}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-text-secondary/30 text-xs">?</span>
          </div>
        )}
      </div>

      {/* Title + year */}
      <div className="min-w-0 flex-1">
        <p className="text-text-primary truncate text-sm font-semibold">
          {cardData !== null ? cardData.name : "—"}
        </p>
        <p className="text-text-secondary font-mono text-xs tabular-nums">
          {cardData !== null ? cardData.release_year : "—"}
        </p>
      </div>

      {/* Result badge */}
      <div className="flex shrink-0 items-center gap-1.5">
        {correct ? (
          <span
            className="rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-300"
            aria-label="Correct placement"
          >
            ✅ Correct
          </span>
        ) : extraTry ? (
          <span
            className="rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-300"
            aria-label="Wrong placement — extra try used"
          >
            ❤️ Discarded
          </span>
        ) : (
          <span
            className="rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-300"
            aria-label="Wrong placement — game ended"
          >
            ❌ Wrong
          </span>
        )}
      </div>
    </div>
  );
}

// ── DailyGameOverScreen ───────────────────────────────────────────────────────

interface DailyGameOverScreenProps {
  challengeNumber: number | null;
  challengeDate: string | null;
  score: number;
  totalCards: number;
  turnsPlayed: number;
  /** True when the player used their one extra try at some point. */
  extraTryUsed: boolean;
  placements: readonly DailyPlacementRecord[];
  revealedCards: Readonly<Record<number, RevealedCardData>>;
  onPlayAgain: () => void;
}

/**
 * Game over screen for the daily challenge with a card-by-card placement review.
 */
export function DailyGameOverScreen({
  challengeNumber,
  challengeDate,
  score,
  totalCards,
  turnsPlayed,
  extraTryUsed,
  placements,
  revealedCards,
  onPlayAgain,
}: DailyGameOverScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const formattedDate =
    challengeDate !== null
      ? new Date(challengeDate + "T12:00:00").toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const reviewItems = buildPlacementReviewItems(placements, revealedCards);
  const correctCount = placements.filter((p) => p.correct).length;
  const completedAll = turnsPlayed >= totalCards;

  return (
    <motion.section
      className="flex min-h-screen w-full items-center justify-center px-4 py-6 md:px-6 md:py-10"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      aria-labelledby="daily-game-over-heading"
    >
      <div className="bg-surface-900/95 w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-col gap-6 px-6 py-8">
          {/* Challenge badge */}
          <div className="flex flex-col items-center gap-3 text-center">
            {challengeNumber !== null && (
              <div className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-300 uppercase">
                Daily Challenge #{challengeNumber}
                {formattedDate !== null && ` — ${formattedDate}`}
              </div>
            )}

            {/* Score */}
            <div>
              <h2
                id="daily-game-over-heading"
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-text-primary text-6xl font-bold tabular-nums focus:outline-none"
              >
                {score}/{totalCards}
              </h2>
              <p className="text-text-secondary mt-2 text-sm">
                {turnsPlayed} card{turnsPlayed !== 1 ? "s" : ""} placed
              </p>
            </div>

            {/* Extra try status */}
            <div
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold",
                extraTryUsed
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-emerald-500/15 text-emerald-300",
              )}
            >
              {completedAll
                ? extraTryUsed
                  ? "❤️ Extra try used"
                  : "💪 Clean run!"
                : "💔 Game ended early"}
            </div>
          </div>

          {/* Placement review */}
          {reviewItems.length > 0 && (
            <div>
              <h3 className="text-text-secondary mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
                Placement Review — {correctCount}/{reviewItems.length} correct
              </h3>
              <div className="flex flex-col gap-2" role="list" aria-label="Placement review">
                {reviewItems.map((item) => (
                  <div key={item.gameId} role="listitem">
                    <PlacementRow
                      index={item.index}
                      correct={item.correct}
                      extraTry={item.extraTry}
                      cardData={item.cardData}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="flex w-full flex-col gap-3">
            <Link
              href="/play/solo"
              className="bg-primary-500 hover:bg-primary-400 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              Play Solo Endless
            </Link>
            <Button onClick={onPlayAgain} variant="outline" className="w-full">
              Come Back Tomorrow
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
