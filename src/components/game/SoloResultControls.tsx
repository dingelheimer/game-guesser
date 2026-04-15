// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlatformBonusInput } from "@/components/game/PlatformBonusInput";
import { MOTION } from "@/lib/motion";
import type { TimelineItem } from "@/components/game/Timeline";
import type { RevealedCardData } from "@/lib/solo/api";
import type { PlatformOption } from "@/lib/platformBonus";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable position description for the placed card.
 * Used to enrich screen reader announcements with placement context.
 */
export function buildPlacementContext(items: TimelineItem[], gameId: number | undefined): string {
  if (gameId === undefined) return "";
  const idx = items.findIndex((t) => t.id === String(gameId));
  if (idx === -1) return "";
  const prev = items[idx - 1];
  const next = items[idx + 1];
  if (prev !== undefined && next !== undefined)
    return `between ${prev.title} (${String(prev.releaseYear)}) and ${next.title} (${String(next.releaseYear)})`;
  if (prev !== undefined) return `after ${prev.title} (${String(prev.releaseYear)})`;
  if (next !== undefined) return `before ${next.title} (${String(next.releaseYear)})`;
  return "as the only card on the timeline";
}

// ── PlacementResult ───────────────────────────────────────────────────────────

function PlacementResult({ correct }: { correct: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold",
        correct ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
      )}
      initial={reduceMotion === true ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={reduceMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: MOTION.duration.fast }}
    >
      {correct ? "✓ Correct!" : "✗ Wrong placement"}
    </motion.div>
  );
}

// ── SoloResultControls ────────────────────────────────────────────────────────

export interface SoloResultControlsProps {
  /** Controls visibility; AnimatePresence handles enter/exit animation. */
  show: boolean;
  /** Whether the last placement was correct (meaningful only when show=true). */
  correct: boolean;
  revealedCard: RevealedCardData | null;
  timelineItems: TimelineItem[];
  availablePlatforms: PlatformOption[];
  correctPlatformIds: number[];
  platformBonusResult: "correct" | "incorrect" | null;
  expertVerificationResult: "correct" | "incorrect" | null;
  isProVariant: boolean;
  isExpertVariant: boolean;
  isTeamworkMode: boolean;
  onAdvanceTurn: () => void;
  onSubmitPlatformGuess: (ids: number[]) => void;
  onSubmitExpertVerification: (year: number, ids: number[]) => void;
}

/**
 * Result panel shown after card placement: verdict banner, platform/expert
 * bonus inputs, and Next Turn button. Manages its own expert-year state and focus.
 */
export function SoloResultControls({
  show,
  correct,
  revealedCard,
  timelineItems,
  availablePlatforms,
  correctPlatformIds,
  platformBonusResult,
  expertVerificationResult,
  isProVariant,
  isExpertVariant,
  isTeamworkMode,
  onAdvanceTurn,
  onSubmitPlatformGuess,
  onSubmitExpertVerification,
}: SoloResultControlsProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [expertYearInput, setExpertYearInput] = useState("");

  // Move focus to the result panel on show so keyboard users can Tab to Next Turn.
  useEffect(() => {
    if (show) divRef.current?.focus();
  }, [show]);

  // Reset expert year input when the result panel closes (between turns).
  useEffect(() => {
    if (!show) setExpertYearInput("");
  }, [show]);

  const gameName = revealedCard?.name ?? "";
  const releaseYear = revealedCard?.release_year ?? 0;
  const placementContext = buildPlacementContext(timelineItems, revealedCard?.game_id);

  const isPlatformBonusPending =
    correct && availablePlatforms.length > 0 && platformBonusResult === null && !isExpertVariant;
  const isExpertVerificationPending =
    correct &&
    availablePlatforms.length > 0 &&
    expertVerificationResult === null &&
    isExpertVariant;

  // Rich screen reader message; empty string when panel is hidden so the live
  // region only announces when actual result data is present.
  const liveRegionText =
    show && revealedCard !== null
      ? correct
        ? `Correct! ${gameName} was released in ${String(releaseYear)}.${placementContext ? ` You placed it ${placementContext}.` : ""}`
        : `Wrong placement. ${gameName} was released in ${String(releaseYear)}.${placementContext ? ` It belonged ${placementContext}.` : ""}`
      : "";

  return (
    <>
      {/* Always-present live region — content change triggers the announcement. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveRegionText}
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
            <PlacementResult correct={correct} />

            {correct && availablePlatforms.length > 0 && (
              <div className="w-full space-y-2">
                {isProVariant ? (
                  <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-100">
                    <strong>PRO Required:</strong> answer the platform bonus correctly to keep this
                    card.
                  </div>
                ) : null}
                {isExpertVariant ? (
                  <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-amber-300">Expert Verification</p>
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-100 uppercase">
                        EXPERT Required
                      </span>
                    </div>
                    <p className="text-sm text-slate-200">
                      Enter the exact release year and all platforms to keep this card.
                    </p>
                    {expertVerificationResult !== null ? (
                      <p
                        className={cn(
                          "text-sm font-medium",
                          expertVerificationResult === "correct"
                            ? "text-emerald-300"
                            : "text-rose-300",
                        )}
                      >
                        {expertVerificationResult === "correct"
                          ? "✓ Verified — card kept!"
                          : "✗ Failed — card lost."}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label
                            htmlFor="solo-expert-year"
                            className="mb-1 block text-xs font-medium text-slate-300"
                          >
                            Release year
                          </label>
                          <input
                            id="solo-expert-year"
                            type="number"
                            inputMode="numeric"
                            placeholder="e.g. 2001"
                            value={expertYearInput}
                            onChange={(e) => {
                              setExpertYearInput(e.target.value);
                            }}
                            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60"
                          />
                        </div>
                        <PlatformBonusInput
                          platforms={availablePlatforms}
                          correctPlatformIds={correctPlatformIds}
                          result={null}
                          onSubmit={(selectedPlatformIds) => {
                            const year = parseInt(expertYearInput, 10);
                            if (!isNaN(year)) {
                              onSubmitExpertVerification(year, selectedPlatformIds);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <PlatformBonusInput
                    platforms={availablePlatforms}
                    correctPlatformIds={correctPlatformIds}
                    result={platformBonusResult}
                    onSubmit={onSubmitPlatformGuess}
                  />
                )}
              </div>
            )}

            <Button
              onClick={onAdvanceTurn}
              className="w-full max-w-sm"
              aria-label={!correct && !isTeamworkMode ? "See game over screen" : "Next turn"}
              disabled={
                (isProVariant && isPlatformBonusPending) ||
                (isExpertVariant && isExpertVerificationPending)
              }
            >
              {!correct && !isTeamworkMode ? "See Result" : "Next Turn →"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
