// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Image from "next/image";
import { siteConfig } from "@/lib/site";

const SESSION_KEY = "donation-prompt-shown";

interface DonationPromptProps {
  /** Number of cards the player placed correctly in this game. */
  correctPlacements: number;
}

/**
 * Subtle one-time donation prompt shown after good games (3+ correct
 * placements). Displays at most once per browser session and is dismissible.
 */
export function DonationPrompt({ correctPlacements }: DonationPromptProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (correctPlacements < 3) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY) !== null)
      return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(true);
  }, [correctPlacements]);

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-amber-500/5 px-4 py-2.5 text-sm">
      <a
        href={siteConfig.kofiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-secondary hover:text-text-primary flex items-center gap-2 transition-colors"
      >
        <Image src="/kofi.svg" alt="" width={16} height={16} className="opacity-60" aria-hidden />
        Enjoying the game? ☕ Buy us a coffee
      </a>
      <button
        onClick={() => {
          setVisible(false);
        }}
        aria-label="Dismiss donation prompt"
        className="text-text-disabled hover:text-text-secondary shrink-0 transition-colors"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
