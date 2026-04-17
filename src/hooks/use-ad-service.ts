// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useContext } from "react";
import { AdServiceContext, type AdService } from "@/lib/ads/ad-service";

/** Access the current AdService from any client component. */
export function useAdService(): AdService {
  return useContext(AdServiceContext);
}
