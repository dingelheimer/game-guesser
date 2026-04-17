// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Conditionally renders Vercel Analytics and Speed Insights only when the
 * user has accepted the `analytics` consent category.
 *
 * Listens to the `consent-updated` CustomEvent dispatched by CookieConsentBanner
 * so re-renders are triggered without coupling to vanilla-cookieconsent internals.
 */
export function ConsentGatedAnalytics() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    function sync() {
      setAnalyticsAllowed(CookieConsent.acceptedCategory("analytics"));
    }

    // Check immediately in case consent was already given on a prior visit.
    sync();

    window.addEventListener("consent-updated", sync);
    return () => {
      window.removeEventListener("consent-updated", sync);
    };
  }, []);

  if (!analyticsAllowed) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
