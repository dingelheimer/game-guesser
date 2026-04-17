// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { getConsentState } from "./consent-manager";
import { defaultAdConfig } from "./ad-config";
import { NullProvider } from "./providers/null-provider";
import type { AdConfig, AdProvider, ConsentState } from "./types";

export class AdService {
  readonly consent: ConsentState;
  readonly provider: AdProvider;
  readonly config: AdConfig;

  constructor(consent: ConsentState, provider: AdProvider, config: AdConfig) {
    this.consent = consent;
    this.provider = provider;
    this.config = config;
  }
}

const defaultConsent: ConsentState = { necessary: true, analytics: false, ads: false };

export const AdServiceContext = createContext<AdService>(
  new AdService(defaultConsent, new NullProvider(), defaultAdConfig),
);

/**
 * Provides AdService to the component tree and handles consent updates and
 * route-change slot cleanup.
 */
export function AdServiceProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<AdService>(
    () => new AdService(defaultConsent, new NullProvider(), defaultAdConfig),
  );

  // Read actual consent on mount and reinitialise the provider.
  useEffect(() => {
    const consent = getConsentState();
    const initial = new AdService(consent, new NullProvider(), defaultAdConfig);
    void initial.provider.init(consent);
    setService(initial);

    function handleConsentUpdate() {
      setService((prev) => {
        const newConsent = getConsentState();
        const updated = new AdService(newConsent, prev.provider, prev.config);
        void updated.provider.init(newConsent);
        return updated;
      });
    }

    window.addEventListener("consent-updated", handleConsentUpdate);
    return () => {
      window.removeEventListener("consent-updated", handleConsentUpdate);
    };
  }, []);

  // Destroy ad slots on route changes (equivalent to useAdLifecycle).
  const providerRef = useRef(service.provider);
  providerRef.current = service.provider;
  const pathname = usePathname();
  const destroy = useCallback(() => {
    providerRef.current.destroySlots();
  }, []);
  useEffect(() => {
    return destroy;
  }, [pathname, destroy]);

  return <AdServiceContext value={service}>{children}</AdServiceContext>;
}
