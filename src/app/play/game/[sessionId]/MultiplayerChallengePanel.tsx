// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Props for the multiplayer challenge-window panel.
 */
export type MultiplayerChallengePanelProps = Readonly<{
  acceptedCount: number;
  activePlayerName: string | null;
  canChallenge: boolean;
  challengeNotice: string | null;
  hasCurrentUserAccepted: boolean;
  isAcceptingChallenge: boolean;
  isCurrentUserActive: boolean;
  isSubmittingChallenge: boolean;
  isVisible: boolean;
  onAcceptChallenge: () => void;
  onChallenge: () => void;
  playerTokens: number;
  secondsRemaining: number | null;
  totalRequired: number;
}>;

/**
 * Render the multiplayer challenge countdown, CTA, and challenge status notice.
 */
export function MultiplayerChallengePanel({
  acceptedCount,
  activePlayerName,
  canChallenge,
  challengeNotice,
  hasCurrentUserAccepted,
  isAcceptingChallenge,
  isCurrentUserActive,
  isSubmittingChallenge,
  isVisible,
  onAcceptChallenge,
  onChallenge,
  playerTokens,
  secondsRemaining,
  totalRequired,
}: MultiplayerChallengePanelProps) {
  if (!isVisible && challengeNotice === null) {
    return null;
  }

  const showAcceptProgress = isVisible && totalRequired > 0 && acceptedCount > 0;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        isVisible
          ? "border-challenge/40 bg-challenge/10"
          : "border-challenge/20 bg-challenge/5 text-slate-100",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-challenge text-sm font-semibold">Challenge Window</p>
          {challengeNotice !== null ? (
            <p className="text-sm text-slate-100">{challengeNotice}</p>
          ) : isCurrentUserActive ? (
            <p className="text-sm text-slate-100">
              Waiting to see whether another player challenges your placement.
            </p>
          ) : (
            <p className="text-sm text-slate-100">
              Spend 1 token to challenge {activePlayerName ?? "this player"} if you think the card
              is placed incorrectly.
            </p>
          )}
          {showAcceptProgress ? (
            <p className="text-xs text-slate-200/60">
              {acceptedCount}/{totalRequired} accepted
            </p>
          ) : null}
        </div>

        {isVisible && secondsRemaining !== null ? (
          <span className="border-challenge/40 rounded-full border bg-black/20 px-3 py-1 text-xs font-medium text-slate-100">
            {secondsRemaining}s left
          </span>
        ) : null}
      </div>

      {isVisible && !isCurrentUserActive ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-200/80">Tokens available: {playerTokens}</p>
          <div className="flex flex-wrap gap-2">
            {hasCurrentUserAccepted ? (
              <Button
                type="button"
                disabled
                variant="outline"
                className="border-emerald-500/40 text-emerald-300 opacity-80"
              >
                Accepted ✓
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isAcceptingChallenge}
                onClick={onAcceptChallenge}
                variant="outline"
                className="border-slate-500/60 text-slate-200 hover:border-slate-400/80 hover:text-white"
              >
                {isAcceptingChallenge ? "Accepting..." : "Accept Placement"}
              </Button>
            )}
            <Button
              type="button"
              disabled={!canChallenge || isSubmittingChallenge}
              onClick={onChallenge}
              className="bg-challenge hover:bg-challenge/90 text-white"
            >
              {isSubmittingChallenge ? "Challenging..." : "Challenge (1 token)"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
