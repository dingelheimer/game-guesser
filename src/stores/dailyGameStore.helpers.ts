// SPDX-License-Identifier: AGPL-3.0-only
import type { DailyPlacementRecord, HiddenCardData, RevealedCardData } from "@/lib/daily/api";
import type { TimelineItem } from "@/components/game/Timeline";

export type { DailyPlacementRecord };

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
