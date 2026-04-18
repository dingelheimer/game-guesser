// SPDX-License-Identifier: AGPL-3.0-only
import type { DifficultyTier } from "@/lib/difficulty";
import { checkPlatformGuess, type PlatformOption } from "@/lib/platformBonus";
import type { ShareOutcome, ShareYearRange } from "@/lib/share";
import type { TimelineItem } from "@/components/game/Timeline";
import type { HiddenCardData, RevealedCardData } from "@/lib/solo/api";
import type { HouseRuleParams, LobbySettings } from "@/lib/multiplayer/lobby";

export { checkPlatformGuess };
export type { PlatformOption };

// ── Phase type ────────────────────────────────────────────────────────────────

export type GamePhase =
  | "idle"
  | "starting"
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

export function pickCorrectionTarget(
  validPositions: readonly number[],
  droppedPosition: number,
): number {
  const firstValidPosition = validPositions[0];
  if (firstValidPosition === undefined) return droppedPosition;

  return validPositions.reduce((bestPosition, candidatePosition) => {
    const bestDistance = Math.abs(bestPosition - droppedPosition);
    const candidateDistance = Math.abs(candidatePosition - droppedPosition);

    if (candidateDistance < bestDistance) return candidatePosition;
    if (candidateDistance === bestDistance) return Math.min(bestPosition, candidatePosition);
    return bestPosition;
  }, firstValidPosition);
}

// ── Store interface ───────────────────────────────────────────────────────────

export interface SoloGameState {
  phase: GamePhase;
  error: string | null;

  sessionId: string | null;
  difficulty: DifficultyTier | null;
  variant: LobbySettings["variant"] | null;
  gameMode: LobbySettings["gameMode"] | null;
  /** Active house rules for the current or last game. */
  houseRules: HouseRuleParams | null;

  /** The card the player is currently placing (hidden — screenshot only). */
  currentCard: HiddenCardData | null;
  /** Queued next card, available after a correct turn. */
  nextCard: HiddenCardData | null;
  /** The card shown after reveal (correct or incorrect). */
  revealedCard: RevealedCardData | null;

  timelineItems: TimelineItem[];
  /** Position where the current card was last dropped. */
  droppedPosition: number | null;
  /** Target position for incorrect-placement slide animation. */
  correctionTargetPosition: number | null;

  score: number;
  turnsPlayed: number;
  bestStreak: number;
  currentStreak: number;
  bonusPointsEarned: number;
  bonusOpportunities: number;
  shareOutcomes: ShareOutcome[];
  shareYearRange: ShareYearRange | null;

  /** Result of the last placement. null during placing/submitting. */
  lastPlacementCorrect: boolean | null;
  /** Valid insertion indices returned when placement is incorrect. */
  validPositions: number[] | null;

  /** Platform options shown to the player after a correct placement. */
  availablePlatforms: PlatformOption[];
  /** Correct platform IDs for client-side bonus validation. */
  correctPlatformIds: number[];
  /** Result of the platform bonus round. null until submitted. */
  platformBonusResult: "correct" | "incorrect" | null;
  /** Result of the expert verification round. null until submitted. */
  expertVerificationResult: "correct" | "incorrect" | null;

  /** Shared team lives for TEAMWORK mode. null when not in TEAMWORK mode. */
  teamTokens: number | null;
  /** Target score for TEAMWORK solo win condition. null when not in TEAMWORK mode. */
  teamWinCondition: number | null;

  /**
   * The reference card for Higher Lower variant. Always the single revealed
   * card on the timeline. null for all other variants.
   */
  referenceCard: RevealedCardData | null;
  /** The last Higher Lower guess direction. null outside Higher Lower turns. */
  guess: "higher" | "lower" | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  startGame: (
    difficulty: DifficultyTier,
    houseRules?: HouseRuleParams,
    variant?: LobbySettings["variant"],
    gameMode?: LobbySettings["gameMode"],
    teamWinCondition?: number,
  ) => Promise<void>;
  placeCard: (position: number) => Promise<void>;
  /** Higher Lower variant: submit "higher" or "lower" guess against the reference card. */
  guessRelation: (guess: "higher" | "lower") => Promise<void>;
  moveCardToCorrectPosition: () => void;
  revealMovedCard: () => void;
  submitPlatformGuess: (selectedPlatformIds: number[]) => void;
  submitExpertVerification: (yearGuess: number, selectedPlatformIds: number[]) => void;
  advanceTurn: () => void;
  resetGame: () => void;
}
