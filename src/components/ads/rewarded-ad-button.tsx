// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useRewardedAd } from "@/hooks/use-rewarded-ad";
import type { GameMode } from "@/lib/ads/types";

interface RewardedAdButtonProps {
  gameMode: GameMode;
  /** Called after a rewarded ad completes and a token is granted. */
  onTokenEarned: () => void;
}

/**
 * Button that lets a player watch a rewarded ad to earn a token.  Renders
 * nothing when rewarded ads are unavailable for the current game mode or when
 * the active provider has no rewarded ad (Phase 0 always renders nothing).
 */
export function RewardedAdButton({ gameMode, onTokenEarned }: RewardedAdButtonProps) {
  const { available, watchForToken } = useRewardedAd(gameMode);

  if (!available) return null;

  return (
    <button
      type="button"
      className="text-primary-300 hover:text-primary-200 text-sm underline underline-offset-2 transition-colors"
      onClick={() => {
        void watchForToken().then((earned) => {
          if (earned) onTokenEarned();
        });
      }}
    >
      Watch an ad to earn a token
    </button>
  );
}
