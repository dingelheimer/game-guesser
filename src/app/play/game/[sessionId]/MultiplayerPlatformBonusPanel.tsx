"use client";

import { PlatformBonusInput } from "@/components/game/PlatformBonusInput";
import type { PlatformOption } from "@/lib/platformBonus";
import type { PlatformBonusResultPayload } from "@/lib/multiplayer/turns";

/**
 * Props for the multiplayer platform-bonus panel.
 */
export type MultiplayerPlatformBonusPanelProps = Readonly<{
  activePlayerName: string | null;
  isCurrentUserActive: boolean;
  isPro?: boolean;
  isSubmittingPlatformBonus: boolean;
  isVisible: boolean;
  onSubmit: (selectedPlatformIds: number[]) => void;
  options: readonly PlatformOption[];
  result: PlatformBonusResultPayload | null;
  secondsRemaining: number | null;
}>;

/**
 * Render the multiplayer platform-bonus countdown, waiting state, and answer grid.
 */
export function MultiplayerPlatformBonusPanel({
  activePlayerName,
  isCurrentUserActive,
  isPro = false,
  isSubmittingPlatformBonus,
  isVisible,
  onSubmit,
  options,
  result,
  secondsRemaining,
}: MultiplayerPlatformBonusPanelProps) {
  if (!isVisible || options.length === 0) {
    return null;
  }

  const successMessage =
    result?.correct === true
      ? isPro
        ? "✓ Card saved"
        : result.tokenChange > 0
          ? "🎮 +1 token!"
          : "✓ Correct — token cap reached"
      : undefined;

  return (
    <div className="border-primary/30 bg-primary/10 rounded-xl border px-4 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-primary text-sm font-semibold">Platform Bonus</p>
            {isPro ? (
              <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-fuchsia-100 uppercase">
                PRO Required
              </span>
            ) : null}
          </div>
          {result !== null ? (
            <p className="text-sm text-slate-100">
              {isPro
                ? result.correct
                  ? `${activePlayerName ?? "The active player"} answered correctly and kept the card.`
                  : `${activePlayerName ?? "The active player"} missed the platform bonus and lost the card.`
                : result.correct
                  ? `${activePlayerName ?? "The active player"} answered correctly.`
                  : `${activePlayerName ?? "The active player"} missed the platform bonus.`}
            </p>
          ) : isCurrentUserActive ? (
            <p className="text-sm text-slate-100">
              {isPro
                ? "Pick every platform for this game before the timer expires to keep the card."
                : "Pick every platform for this game before the timer expires."}
            </p>
          ) : (
            <p className="text-sm text-slate-100">
              Waiting for {activePlayerName ?? "the active player"} to finish the platform bonus.
            </p>
          )}
        </div>

        {result === null && secondsRemaining !== null ? (
          <span className="border-primary/40 rounded-full border bg-black/20 px-3 py-1 text-xs font-medium text-slate-100">
            {secondsRemaining}s left
          </span>
        ) : null}
      </div>

      {isCurrentUserActive || result !== null ? (
        <PlatformBonusInput
          platforms={[...options]}
          correctPlatformIds={result?.correctPlatforms.map((platform) => platform.id) ?? []}
          result={result === null ? null : result.correct ? "correct" : "incorrect"}
          onSubmit={isSubmittingPlatformBonus ? () => undefined : onSubmit}
          {...(successMessage === undefined ? {} : { successMessage })}
        />
      ) : (
        <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-slate-200/90">
          Waiting for platform bonus...
        </p>
      )}
    </div>
  );
}
