// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAdService } from "./use-ad-service";

/**
 * Destroys active ad slots whenever the route changes.  Call this inside any
 * client component that wraps the page to ensure slots are cleaned up on
 * Next.js client-side navigation.
 */
export function useAdLifecycle(): void {
  const { provider } = useAdService();
  const pathname = usePathname();

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const destroy = useCallback(() => {
    providerRef.current.destroySlots();
  }, []);

  useEffect(() => {
    return destroy;
  }, [pathname, destroy]);
}
