// SPDX-License-Identifier: AGPL-3.0-only
import type { AdProvider, AdResult } from "../types";

/** Phase 0 provider — all methods are no-ops. Zero runtime cost, no external scripts. */
export class NullProvider implements AdProvider {
  async init(): Promise<void> {}

  hasAd(): boolean {
    return false;
  }

  showBanner(): void {}

  showInterstitial(): Promise<AdResult> {
    return Promise.resolve({ completed: false, provider: "null" });
  }

  showRewarded(): Promise<AdResult> {
    return Promise.resolve({ completed: false, provider: "null" });
  }

  destroySlots(): void {}
}
