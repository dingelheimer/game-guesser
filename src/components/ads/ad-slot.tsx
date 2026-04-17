// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useAdService } from "@/hooks/use-ad-service";
import type { AdPlacement } from "@/lib/ads/types";

interface AdSlotProps {
  placement: AdPlacement;
  size: [number, number];
}

/**
 * Reusable banner/rectangle ad slot.  Renders nothing when no ad provider is
 * active or when the provider reports no available ad (Phase 0 always renders
 * nothing).
 */
export function AdSlot({ placement, size }: AdSlotProps) {
  const { provider, consent } = useAdService();

  if (!consent.ads || !provider.hasAd("banner")) return null;

  return (
    <div
      ref={(el) => {
        if (el) provider.showBanner({ id: `ad-${placement}`, placement, size });
      }}
      style={{ width: size[0], height: size[1] }}
      aria-hidden="true"
    />
  );
}
