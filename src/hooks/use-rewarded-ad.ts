// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import type { GameMode } from "@/lib/ads/types";
import { useAdService } from "./use-ad-service";

export interface UseRewardedAdResult {
  available: boolean;
  watchForToken: () => Promise<boolean>;
}

/**
 * Returns rewarded-ad availability for the given game mode and a trigger
 * function.  Rewarded ads are disabled for multiplayer to preserve competitive
 * balance.  In Phase 0 (NullProvider) `available` is always `false`.
 */
export function useRewardedAd(gameMode: GameMode): UseRewardedAdResult {
  const { provider, config } = useAdService();

  const available =
    config.rewardedAllowedModes.includes(gameMode) && provider.hasAd("rewarded");

  async function watchForToken(): Promise<boolean> {
    if (!available) return false;
    const result = await provider.showRewarded();
    // Server-side token grant would happen here in a future phase.
    return result.completed;
  }

  return { available, watchForToken };
}
