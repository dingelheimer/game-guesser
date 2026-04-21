// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DailyGameOverScreenProps {
  challengeNumber: number | null;
  challengeDate: string | null;
  score: number;
  totalCards: number;
  turnsPlayed: number;
  /** True when the player used their one extra try at some point. */
  extraTryUsed: boolean;
  onPlayAgain: () => void;
}

/**
 * Minimal game over screen for the daily challenge.
 * Story 33.5 will expand this with a full placement review and share card.
 */
export function DailyGameOverScreen({
  challengeNumber,
  challengeDate,
  score,
  totalCards,
  turnsPlayed,
  extraTryUsed,
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

  return (
    <motion.section
      className="flex min-h-screen w-full items-center justify-center px-4 py-6 md:px-6 md:py-10"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      aria-labelledby="daily-game-over-heading"
    >
      <div className="bg-surface-900/95 w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-col items-center gap-6 px-6 py-8 text-center">
          {/* Challenge badge */}
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
            {extraTryUsed ? "❤️ Extra try used" : "💪 Clean run!"}
          </div>

          {/* CTAs */}
          <div className="flex w-full flex-col gap-3">
            <Button onClick={onPlayAgain} variant="outline" className="w-full">
              <RotateCcw className="size-4" aria-hidden="true" />
              Come Back Tomorrow
            </Button>
            <Link
              href="/play/solo"
              className="bg-primary-500 hover:bg-primary-400 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              Play Solo Endless
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
