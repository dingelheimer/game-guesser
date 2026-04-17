// SPDX-License-Identifier: AGPL-3.0-only

/** Consent state categories from the cookie consent banner. */
export interface ConsentState {
  /** Always true — auth session and consent cookie. */
  necessary: boolean;
  /** Vercel Analytics and Speed Insights. */
  analytics: boolean;
  /** Ad serving and personalization. */
  ads: boolean;
}

export type AdType = "banner" | "interstitial" | "rewarded";

export type AdResult = { completed: boolean; provider: string };

export interface AdSlot {
  id: string;
  placement: AdPlacement;
  size: [number, number];
}

export type AdPlacement = "lobby" | "leaderboard" | "game-over" | "solo-turn";

export type GameMode = "solo" | "endless" | "multiplayer";

export interface AdConfig {
  placements: {
    banner: AdPlacement[];
    interstitial: AdPlacement[];
    rewarded: AdPlacement[];
  };
  frequencyCaps: {
    interstitial: { maxPerSession: number; cooldownSeconds: number };
    rewarded: { maxPerDay: number };
  };
  /** Rewarded ads are only available in these modes (not multiplayer). */
  rewardedAllowedModes: GameMode[];
}

/** Common interface for all ad provider adapters. */
export interface AdProvider {
  init(consent: ConsentState): Promise<void>;
  hasAd(type: AdType): boolean;
  showBanner(slot: AdSlot): void;
  showInterstitial(): Promise<AdResult>;
  showRewarded(): Promise<AdResult>;
  destroySlots(): void;
}
