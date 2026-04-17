// SPDX-License-Identifier: AGPL-3.0-only
import * as CookieConsent from "vanilla-cookieconsent";
import type { ConsentState } from "./types";

/** Read the current consent state from vanilla-cookieconsent. */
export function getConsentState(): ConsentState {
  return {
    necessary: true,
    analytics: CookieConsent.acceptedCategory("analytics"),
    ads: CookieConsent.acceptedCategory("ads"),
  };
}
