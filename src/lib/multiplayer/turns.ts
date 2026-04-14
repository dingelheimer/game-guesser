import type { TimelineEntry } from "./deck";
import type { LobbySettings } from "./lobby";
import type { PlatformOption } from "@/lib/platformBonus";

/**
 * Broadcast payload emitted when the active player picks a placement position.
 */
export type PlacementMadePayload = Readonly<{
  activePlayerId: string;
  challengeDeadline?: string;
  position: number;
}>;

/**
 * Challenge-resolution outcomes for a revealed multiplayer turn.
 */
export type ChallengeResult = "challenger_wins" | "challenger_loses";

/**
 * Broadcast payload emitted when a player spends a token to challenge a placement.
 */
export type ChallengeMadePayload = Readonly<{
  challengerId: string;
  displayName: string;
}>;

/**
 * Multiplayer card metadata revealed after the server resolves a turn.
 */
export type RevealedTurnCard = Readonly<{
  coverImageId: string | null;
  gameId: number;
  name: string;
  platform: string;
  releaseYear: number;
  screenshotImageId: string;
}>;

/**
 * Broadcast payload emitted once the server has revealed a placed card.
 */
export type TurnRevealedPayload = Readonly<{
  card: RevealedTurnCard;
  challengeResult?: ChallengeResult;
  challengerId?: string;
  isCorrect: boolean;
  platformBonusDeadline?: string;
  platformOptions?: readonly PlatformOption[];
  platformBonusPlayerId?: string;
  position: number;
  scores: Readonly<Record<string, number>>;
  timelines: Readonly<Record<string, readonly TimelineEntry[]>>;
  tokens: Readonly<Record<string, number>>;
}>;

/**
 * Broadcast payload emitted when the multiplayer platform bonus resolves.
 */
export type PlatformBonusResultPayload = Readonly<{
  correct: boolean;
  correctPlatforms: readonly PlatformOption[];
  scores: Readonly<Record<string, number>>;
  timelines: Readonly<Record<string, readonly TimelineEntry[]>>;
  tokenChange: number;
  tokens: Readonly<Record<string, number>>;
}>;

/**
 * Reasons a multiplayer turn can be skipped.
 */
export type TurnSkippedReason = "disconnect_timeout" | "turn_timer_expired";

/**
 * Broadcast payload emitted when the current turn is skipped.
 */
export type TurnSkippedPayload = Readonly<{
  playerId: string;
  reason: TurnSkippedReason;
}>;

/**
 * Broadcast payload emitted when the next multiplayer turn begins.
 */
export type TurnStartedPayload = Readonly<{
  activePlayerId: string;
  deadline: string | null;
  screenshot: Readonly<{ screenshotImageId: string }>;
  turnNumber: number;
}>;

/**
 * Broadcast payload emitted when a multiplayer session reaches its final standings.
 */
export type GameOverPayload = Readonly<{
  displayName: string;
  finalScores: Readonly<Record<string, number>>;
  finalTimelines: Readonly<Record<string, readonly TimelineEntry[]>>;
  winnerId: string;
}>;

/**
 * Return the placing-phase deadline for the supplied turn timer setting.
 */
export function buildPhaseDeadline(
  turnTimer: LobbySettings["turnTimer"],
  now = Date.now(),
): string | null {
  if (turnTimer === "unlimited") {
    return null;
  }

  return new Date(now + parseInt(turnTimer, 10) * 1000).toISOString();
}

/**
 * Return the fixed 10-second deadline for the multiplayer challenge window.
 */
export function buildChallengeDeadline(now = Date.now()): string {
  return new Date(now + 10_000).toISOString();
}

/**
 * Return the fixed 15-second deadline for the multiplayer platform bonus window.
 */
export function buildPlatformBonusDeadline(now = Date.now()): string {
  return new Date(now + 15_000).toISOString();
}

/**
 * Insert a timeline entry at a specific chronological position.
 */
export function insertTimelineEntry(
  timeline: readonly TimelineEntry[],
  entry: TimelineEntry,
  position: number,
): TimelineEntry[] {
  return [...timeline.slice(0, position), entry, ...timeline.slice(position)];
}

/**
 * Find the canonical insertion point for a revealed card in chronological order.
 */
export function findTimelineInsertPosition(
  timeline: readonly TimelineEntry[],
  releaseYear: number,
): number {
  const nextLaterIndex = timeline.findIndex((entry) => entry.releaseYear > releaseYear);
  return nextLaterIndex === -1 ? timeline.length : nextLaterIndex;
}

/**
 * Check whether a release year fits the supplied timeline position.
 * Same-year adjacency is considered correct.
 */
export function isPlacementCorrect(
  timeline: readonly TimelineEntry[],
  releaseYear: number,
  position: number,
): boolean {
  if (position < 0 || position > timeline.length) {
    return false;
  }

  const previousYear =
    position > 0 ? (timeline[position - 1]?.releaseYear ?? -Infinity) : -Infinity;
  const nextYear =
    position < timeline.length ? (timeline[position]?.releaseYear ?? Infinity) : Infinity;

  return releaseYear >= previousYear && releaseYear <= nextYear;
}

/**
 * Return the next round-robin player index for a turn order.
 */
export function getNextTurnIndex(
  turnOrder: readonly string[],
  activePlayerId: string,
): number | null {
  const activeIndex = turnOrder.indexOf(activePlayerId);
  if (activeIndex === -1 || turnOrder.length === 0) {
    return null;
  }

  return (activeIndex + 1) % turnOrder.length;
}
