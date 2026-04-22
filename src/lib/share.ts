// SPDX-License-Identifier: AGPL-3.0-only
import { formatPlatformBonusSummary, formatShareOutcomeGrid } from "@/lib/shareResult";

/** Placement outcome labels used by spoiler-free share summaries. */
export type ShareOutcome = "correct" | "close" | "wrong";

/** Inclusive year range shown in spoiler-free share summaries. */
export type ShareYearRange = Readonly<{
  start: number;
  end: number;
}>;

interface ShareClipboard {
  writeText: (text: string) => Promise<void>;
}

type ShareNavigator = {
  clipboard?: ShareClipboard;
  share?: (data: ShareData) => Promise<void>;
};

interface ShareNotifier {
  success: (title: string, options: { description: string }) => void;
  error: (title: string, options: { description: string }) => void;
}

/** Expand the tracked share range to include a newly revealed year. */
export function extendShareYearRange(range: ShareYearRange | null, year: number): ShareYearRange {
  if (range === null) {
    return { end: year, start: year };
  }

  return {
    end: Math.max(range.end, year),
    start: Math.min(range.start, year),
  };
}

/** Classify a placement as correct, close, or wrong for spoiler-free sharing. */
export function classifyPlacementOutcome(
  timelineYears: readonly number[],
  attemptedPosition: number,
  releaseYear: number,
): ShareOutcome {
  const previousYear =
    attemptedPosition > 0
      ? (timelineYears[attemptedPosition - 1] ?? Number.NEGATIVE_INFINITY)
      : Number.NEGATIVE_INFINITY;
  const nextYear =
    attemptedPosition < timelineYears.length
      ? (timelineYears[attemptedPosition] ?? Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;

  if (releaseYear >= previousYear && releaseYear <= nextYear) {
    return "correct";
  }

  const gapToPrevious = Number.isFinite(previousYear)
    ? Math.abs(releaseYear - previousYear)
    : Number.POSITIVE_INFINITY;
  const gapToNext = Number.isFinite(nextYear)
    ? Math.abs(nextYear - releaseYear)
    : Number.POSITIVE_INFINITY;

  return Math.min(gapToPrevious, gapToNext) <= 2 ? "close" : "wrong";
}

/** Build the spoiler-free solo share text shown on the solo game-over screen. */
export function buildSoloShareText({
  outcomes,
  platformBonusEarned,
  platformBonusOpportunities,
  score,
  turnsPlayed,
  yearRange,
}: {
  outcomes: readonly ShareOutcome[];
  platformBonusEarned: number;
  platformBonusOpportunities: number;
  score: number;
  turnsPlayed: number;
  yearRange: ShareYearRange;
}): string {
  return [
    "🎮 Game Guesser — Solo",
    `${formatShareOutcomeGrid(outcomes)} ${String(Math.max(0, score))}/${String(Math.max(0, turnsPlayed))}`,
    `⏱ ${String(yearRange.start)} → ${String(yearRange.end)}`,
    formatPlatformBonusSummary(platformBonusEarned, platformBonusOpportunities),
  ].join("\n");
}

/** Build the spoiler-free multiplayer share text shown on the match standings screen. */
export function buildMultiplayerShareText({
  outcomes,
  placement,
  playerCount,
  platformBonusEarned,
  platformBonusOpportunities,
  score,
  turnsPlayed,
}: {
  outcomes: readonly ShareOutcome[];
  placement: number;
  playerCount: number;
  platformBonusEarned: number;
  platformBonusOpportunities: number;
  score: number;
  turnsPlayed: number;
}): string {
  return [
    "🎮 Game Guesser — Multiplayer",
    `🏆 ${formatOrdinal(placement)} place (${String(playerCount)} players)`,
    `${formatShareOutcomeGrid(outcomes)} ${String(Math.max(0, score))}/${String(Math.max(0, turnsPlayed))}`,
    formatPlatformBonusSummary(platformBonusEarned, platformBonusOpportunities),
  ].join("\n");
}

/** Share text via the Web Share API when available, then fall back to the clipboard. */
export async function shareResult({
  navigator,
  notify,
  text,
  url,
}: {
  navigator: ShareNavigator;
  notify: ShareNotifier;
  text: string;
  url?: string;
}): Promise<void> {
  const shareData: ShareData = url === undefined ? { text } : { text, url };
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      notify.success("Shared!", {
        description: "Your result is ready to post.",
      });
      return;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  if (navigator.clipboard?.writeText === undefined) {
    notify.error("Clipboard unavailable", {
      description: "Sharing only works in a secure browser context.",
    });
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    notify.success("Copied to clipboard!", {
      description: "Your result is ready to paste.",
    });
  } catch (error: unknown) {
    notify.error("Could not share result", {
      description: error instanceof Error ? error.message : "The browser blocked clipboard access.",
    });
  }
}

function formatOrdinal(value: number): string {
  const remainder10 = value % 10;
  const remainder100 = value % 100;
  if (remainder10 === 1 && remainder100 !== 11) {
    return `${String(value)}st`;
  }
  if (remainder10 === 2 && remainder100 !== 12) {
    return `${String(value)}nd`;
  }
  if (remainder10 === 3 && remainder100 !== 13) {
    return `${String(value)}rd`;
  }

  return `${String(value)}th`;
}
