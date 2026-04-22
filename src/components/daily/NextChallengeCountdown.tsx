// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h)}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Displays a live countdown to the next daily challenge (00:00 UTC).
 * Updates every second. Renders nothing during SSR to avoid hydration mismatches.
 */
export function NextChallengeCountdown() {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    setSeconds(getSecondsUntilMidnightUTC());
    const id = setInterval(() => {
      setSeconds(getSecondsUntilMidnightUTC());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  if (seconds === null) return null;

  return (
    <p className="text-text-secondary text-sm">
      Next challenge in{" "}
      <span className="text-text-primary font-mono font-semibold tabular-nums">
        {formatCountdown(seconds)}
      </span>
    </p>
  );
}
