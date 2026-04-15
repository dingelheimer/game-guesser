// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { PlatformBonusInput } from "@/components/game/PlatformBonusInput";
import type { PlatformOption } from "@/lib/platformBonus";
import type { ExpertVerificationResultPayload } from "@/lib/multiplayer/turns";

/**
 * Props for the multiplayer expert-verification panel.
 */
export type MultiplayerExpertVerificationPanelProps = Readonly<{
  activePlayerName: string | null;
  isCurrentUserActive: boolean;
  isSubmittingExpertVerification: boolean;
  isVisible: boolean;
  onSubmit: (yearGuess: number, selectedPlatformIds: number[]) => void;
  options: readonly PlatformOption[];
  result: ExpertVerificationResultPayload | null;
  secondsRemaining: number | null;
}>;

/**
 * Render the multiplayer expert-verification countdown, year input, platform grid, and result.
 */
export function MultiplayerExpertVerificationPanel({
  activePlayerName,
  isCurrentUserActive,
  isSubmittingExpertVerification,
  isVisible,
  onSubmit,
  options,
  result,
  secondsRemaining,
}: MultiplayerExpertVerificationPanelProps) {
  const [yearInput, setYearInput] = useState("");
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<Set<number>>(new Set());

  if (!isVisible || options.length === 0) {
    return null;
  }

  function handleTogglePlatform(id: number) {
    setSelectedPlatformIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    const year = parseInt(yearInput, 10);
    if (isNaN(year) || selectedPlatformIds.size === 0 || isSubmittingExpertVerification) {
      return;
    }
    onSubmit(year, [...selectedPlatformIds]);
  }

  const isSubmitDisabled =
    result !== null ||
    isSubmittingExpertVerification ||
    yearInput.trim() === "" ||
    isNaN(parseInt(yearInput, 10)) ||
    selectedPlatformIds.size === 0;

  const platformResult = result !== null ? (result.correct ? "correct" : "incorrect") : null;

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-amber-300">Expert Verification</p>
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-100 uppercase">
              EXPERT Required
            </span>
          </div>
          {result !== null ? (
            <p className="text-sm text-slate-100">
              {result.correct
                ? `${activePlayerName ?? "The active player"} answered correctly and kept the card.`
                : `${activePlayerName ?? "The active player"} missed the expert verification and lost the card.`}
            </p>
          ) : isCurrentUserActive ? (
            <p className="text-sm text-slate-100">
              Enter the exact release year and all platforms to keep this card.
            </p>
          ) : (
            <p className="text-sm text-slate-100">
              Waiting for {activePlayerName ?? "the active player"} to finish expert verification.
            </p>
          )}
        </div>

        {result === null && secondsRemaining !== null ? (
          <span className="rounded-full border border-amber-400/40 bg-black/20 px-3 py-1 text-xs font-medium text-slate-100">
            {secondsRemaining}s left
          </span>
        ) : null}
      </div>

      {isCurrentUserActive || result !== null ? (
        <div className="space-y-3">
          {/* Year input */}
          <div>
            <label
              htmlFor="expert-year-input"
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Release year
            </label>
            <input
              id="expert-year-input"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 2001"
              value={yearInput}
              onChange={(e) => {
                setYearInput(e.target.value);
              }}
              disabled={result !== null}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60 disabled:opacity-50"
            />
            {result !== null && (
              <p className="mt-1 text-xs text-slate-400">
                {result.yearCorrect ? "✓ Year correct" : "✗ Year incorrect"}
              </p>
            )}
          </div>

          {/* Platform grid — drives internal chip rendering but we suppress its submit button */}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-300">Platforms</p>
            {result !== null ? (
              <PlatformBonusInput
                platforms={[...options]}
                correctPlatformIds={result.correctPlatforms.map((p) => p.id)}
                result={platformResult}
                onSubmit={() => undefined}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {options.map((platform) => {
                  const selected = selectedPlatformIds.has(platform.id);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => {
                        handleTogglePlatform(platform.id);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "border-amber-400/60 bg-amber-500/30 text-amber-100"
                          : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      {platform.name}
                    </button>
                  );
                })}
              </div>
            )}
            {result !== null && (
              <p className="mt-1 text-xs text-slate-400">
                {result.platformsCorrect ? "✓ All platforms correct" : "✗ Platforms incorrect"}
              </p>
            )}
          </div>

          {/* Submit button */}
          {result === null ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmittingExpertVerification ? "Submitting…" : "Submit"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-slate-200/90">
          Waiting for expert verification…
        </p>
      )}
    </div>
  );
}
