// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";

/**
 * Initialises vanilla-cookieconsent v3 and renders a GDPR-compliant consent
 * banner. CookieConsent manages its own DOM — this component returns null.
 *
 * Categories:
 *   - necessary  (always on, read-only)
 *   - analytics  (Vercel Analytics + Speed Insights)
 *   - ads        (future ad serving — Phase 1+)
 *
 * Consent changes are broadcast as a `'consent-updated'` CustomEvent on `window`
 * so that sibling components (e.g. ConsentGatedAnalytics) can react without
 * coupling to vanilla-cookieconsent internals.
 */
export function CookieConsentBanner() {
  useEffect(() => {
    function dispatchConsentUpdate() {
      window.dispatchEvent(new CustomEvent("consent-updated"));
    }

    void CookieConsent.run({
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
        analytics: {},
        ads: {},
      },
      onConsent: dispatchConsentUpdate,
      onChange: dispatchConsentUpdate,
      language: {
        default: "en",
        translations: {
          en: {
            consentModal: {
              title: "We use cookies 🍪",
              description:
                "We use essential cookies to keep the game running. With your consent we also collect anonymous analytics to improve Gamester. No personal data is ever sold.",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              showPreferencesBtn: "Manage preferences",
              footer: '<a href="/privacy" target="_blank">Privacy Policy</a>',
            },
            preferencesModal: {
              title: "Cookie preferences",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              savePreferencesBtn: "Save preferences",
              closeIconLabel: "Close modal",
              sections: [
                {
                  title: "Cookie usage",
                  description:
                    "We use cookies to ensure the basic functionality of the site and to enhance your experience. You can choose to opt in or opt out of each category at any time.",
                },
                {
                  title: "Strictly necessary",
                  description:
                    "These cookies are required for the site to function. They include your auth session and your saved consent choice.",
                  linkedCategory: "necessary",
                },
                {
                  title: "Analytics & performance",
                  description:
                    "These cookies help us understand how visitors use the site (page views, performance metrics). We use Vercel Analytics — no personal data is shared with third-party ad networks.",
                  linkedCategory: "analytics",
                },
                {
                  title: "Advertising",
                  description:
                    "We plan to show non-intrusive ads to support development. This category is reserved for future use — no ad cookies are set today.",
                  linkedCategory: "ads",
                },
              ],
            },
          },
        },
      },
      guiOptions: {
        consentModal: {
          layout: "cloud inline",
          position: "bottom center",
          equalWeightButtons: true,
          flipButtons: false,
        },
        preferencesModal: {
          layout: "box",
          equalWeightButtons: true,
          flipButtons: false,
        },
      },
    });
  }, []);

  return null;
}
