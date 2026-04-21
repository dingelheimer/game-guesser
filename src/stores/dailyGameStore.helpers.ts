// SPDX-License-Identifier: AGPL-3.0-only
import type { DailyPlacementRecord, HiddenCardData, RevealedCardData } from "@/lib/daily/api";
import type { TimelineItem } from "@/components/game/Timeline";

export type { DailyPlacementRecord };

// ── Placement review helpers ──────────────────────────────────────────────────

/** A single placement entry enriched with full card data for the review screen. */
export interface PlacementReviewItem {
  /** 1-based index of this placement in the game. */
  index: number;
  gameId: number;
  correct: boolean;
  /** True when this wrong placement consumed the extra try (card was discarded). */
  extraTry: boolean;
  /** Full card data if available (populated during live play). Null for resume cases. */
  cardData: RevealedCardData | null;
}

/**
 * Maps placement records and accumulated card data into display-ready review items.
 * Returns one item per placement in the order they were played.
 */
export function buildPlacementReviewItems(
  placements: readonly DailyPlacementRecord[],
  revealedCards: Readonly<Record<number, RevealedCardData>>,
): PlacementReviewItem[] {
  return placements.map((p, i) => ({
    index: i + 1,
    gameId: p.game_id,
    correct: p.correct,
    extraTry: p.extra_try === true,
    cardData: revealedCards[p.game_id] ?? null,
  }));
}

// ── Phase type ────────────────────────────────────────────────────────────────

export type DailyGamePhase =
  | "idle"
  | "loading"
  | "placing"
  | "submitting"
  | "revealing"
  | "game_over";

// ── Pure helper functions ─────────────────────────────────────────────────────

export function revealedToTimelineItem(card: RevealedCardData): TimelineItem {
  return {
    id: String(card.game_id),
    screenshotImageId: card.screenshot_image_ids[0] ?? null,
    coverImageId: card.cover_image_id,
    title: card.name,
    releaseYear: card.release_year,
    platform: card.platform_names[0] ?? "Unknown",
    isRevealed: true,
  };
}

export function hiddenToTimelineItem(card: HiddenCardData): TimelineItem {
  return {
    id: String(card.game_id),
    screenshotImageId: card.screenshot_image_ids[0] ?? null,
    coverImageId: null,
    title: "?",
    releaseYear: 0,
    platform: "?",
    isRevealed: false,
  };
}

export function insertAtPosition<T>(arr: T[], item: T, position: number): T[] {
  return [...arr.slice(0, position), item, ...arr.slice(position)];
}

// ── Store interface ───────────────────────────────────────────────────────────

export interface DailyGameState {
  phase: DailyGamePhase;
  error: string | null;

  resultId: number | null;
  challengeNumber: number | null;
  challengeDate: string | null;
  totalCards: number;
  /** Anonymous ID persisted in localStorage for guest identity. */
  anonymousId: string | null;

  /** The card the player is currently placing (hidden — screenshot only). */
  currentCard: HiddenCardData | null;
  /** The card shown after reveal (correct or incorrect). */
  revealedCard: RevealedCardData | null;
  /** Queued next card, available after a turn. */
  nextCard: HiddenCardData | null;

  timelineItems: TimelineItem[];
  /** Position where the current card was last dropped. */
  droppedPosition: number | null;

  score: number;
  turnsPlayed: number;
  extraTryAvailable: boolean;
  placements: DailyPlacementRecord[];
  /**
   * Full card data for each game revealed so far, keyed by game_id.
   * Populated during live play; empty for the completed-resume path.
   */
  revealedCards: Readonly<Record<number, RevealedCardData>>;

  /** Result of the last placement. null during placing/submitting. */
  lastPlacementCorrect: boolean | null;
  /** Valid insertion indices returned when placement is incorrect. */
  validPositions: number[] | null;
  /** Whether the game is over (set from the turn response). */
  gameOver: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────

  startDaily: () => Promise<void>;
  placeCard: (position: number) => Promise<void>;
  advanceTurn: () => void;
  resetGame: () => void;
}
