// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import * as CookieConsent from "vanilla-cookieconsent";
import { cn } from "@/lib/utils";

interface PrivacySettingsButtonProps {
  className?: string;
}

/** Button that opens the cookie consent preferences modal. */
export function PrivacySettingsButton({ className }: PrivacySettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        CookieConsent.showPreferences();
      }}
      className={cn("text-muted-foreground hover:text-foreground transition-colors", className)}
    >
      Privacy Settings
    </button>
  );
}
