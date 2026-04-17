// SPDX-License-Identifier: AGPL-3.0-only
import type { AdConfig } from "./types";

export const defaultAdConfig: AdConfig = {
  placements: {
    banner: ["lobby", "leaderboard"],
    interstitial: ["game-over"],
    rewarded: ["solo-turn"],
  },
  frequencyCaps: {
    interstitial: { maxPerSession: 1, cooldownSeconds: 60 },
    rewarded: { maxPerDay: 5 },
  },
  rewardedAllowedModes: ["solo", "endless"],
};
