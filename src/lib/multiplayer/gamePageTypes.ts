// SPDX-License-Identifier: AGPL-3.0-only
import type { z } from "zod";
import type { PlatformOption } from "@/lib/platformBonus";
import type { DisplayNameSchema, LobbyPlayerRole, LobbySettings } from "./lobby";
import type { TurnPhase } from "./deck";
import type { GameRowSchema } from "./gamePageSchemas";

/**
 * Hydrated card shown inside a multiplayer player's revealed timeline.
 */
export type MultiplayerTimelineCard = Readonly<{
  coverImageId: string | null;
  gameId: number;
  isRevealed: boolean;
  platform: string;
  releaseYear: number;
  screenshotImageId: string | null;
  title: string;
}>;

/**
 * Display state for the currently active multiplayer turn card.
 */
export type MultiplayerTurnCard = Readonly<{
  coverImageId: string | null;
  gameId: number | null;
  isRevealed: boolean;
  platform: string;
  releaseYear: number | null;
  screenshotImageId: string | null;
  title: string;
}>;

/**
 * Player payload rendered by the multiplayer game page.
 */
export type MultiplayerGamePagePlayer = Readonly<{
  displayName: z.infer<typeof DisplayNameSchema>;
  joinedAt: string;
  role: LobbyPlayerRole;
  score: number;
  timeline: readonly MultiplayerTimelineCard[];
  tokens: number;
  turnPosition: number;
  userId: string;
}>;

/**
 * Serializable server payload used to render and hydrate the multiplayer game page.
 */
export type MultiplayerGamePageData = Readonly<{
  currentTurn: Readonly<{
    activePlayerId: string;
    card: MultiplayerTurnCard;
    phase: TurnPhase;
    phaseDeadline: string | null;
    platformOptions: readonly PlatformOption[];
    platformBonusPlayerId?: string | null;
    votes?: Readonly<Record<string, Readonly<{ position: number; locked: boolean }>>>;
  }>;
  currentUserId: string;
  players: readonly MultiplayerGamePagePlayer[];
  roomId: string;
  sessionId: string;
  settings: LobbySettings;
  status: "active" | "finished";
  teamScore: number | null;
  teamTimeline: readonly MultiplayerTimelineCard[] | null;
  teamTokens: number | null;
  turnNumber: number;
  winner: Readonly<{
    displayName: z.infer<typeof DisplayNameSchema>;
    userId: string;
  }> | null;
}>;

/** Build a hidden turn card (screenshot only, no metadata revealed). */
export function buildHiddenTurnCard(
  gameId: number | null,
  screenshotImageId: string,
): MultiplayerTurnCard {
  return {
    gameId,
    screenshotImageId,
    coverImageId: null,
    title: "?",
    releaseYear: null,
    platform: "",
    isRevealed: false,
  };
}

/** Build a fully revealed turn card with game metadata. */
export function buildRevealedTurnCard(
  game: z.infer<typeof GameRowSchema>,
  screenshotImageId: string,
  coverImageId: string | null,
  platform: string,
): MultiplayerTurnCard {
  return {
    coverImageId,
    gameId: game.id,
    isRevealed: true,
    platform,
    releaseYear: game.release_year,
    screenshotImageId,
    title: game.name,
  };
}
