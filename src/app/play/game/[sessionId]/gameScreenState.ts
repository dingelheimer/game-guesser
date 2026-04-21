// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import type {
  MultiplayerGamePageData,
  MultiplayerGamePagePlayer,
  MultiplayerTimelineCard,
  MultiplayerTurnCard,
} from "@/lib/multiplayer/gamePage";
import type { TeamGameOverPayload } from "@/lib/multiplayer/turns";
import { PlatformOptionSchema } from "@/lib/platformBonus";

const BroadcastTimelineEntrySchema = z.object({
  gameId: z.number().int(),
  name: z.string(),
  releaseYear: z.number().int(),
});

/**
 * Broadcast payload schema for the game_started event.
 */
export const GameStartedPayloadSchema = z.object({
  sessionId: z.uuid(),
  turnOrder: z.array(z.uuid()),
  startingCards: z.record(z.string(), BroadcastTimelineEntrySchema),
  firstCard: z.object({ screenshotImageId: z.string() }),
});

/**
 * Broadcast payload schema for the placement_made event.
 */
export const PlacementMadePayloadSchema = z.object({
  activePlayerId: z.uuid(),
  challengeDeadline: z.iso.datetime({ offset: true }).optional(),
  position: z.number().int(),
});

/**
 * Broadcast payload schema for the challenge_made event.
 */
export const ChallengeMadePayloadSchema = z.object({
  challengerId: z.uuid(),
  displayName: z.string(),
});

/**
 * Broadcast payload schema for the turn_started event.
 */
export const TurnStartedPayloadSchema = z.object({
  activePlayerId: z.uuid(),
  deadline: z.iso.datetime({ offset: true }).nullable().optional(),
  screenshot: z.union([z.string(), z.object({ screenshotImageId: z.string() })]),
  turnNumber: z.number().int(),
});

const TurnRevealedCardSchema = z.object({
  coverImageId: z.string().nullable(),
  gameId: z.number().int(),
  name: z.string(),
  platform: z.string(),
  releaseYear: z.number().int(),
  screenshotImageId: z.string(),
});

/**
 * Broadcast payload schema for the turn_revealed event.
 * `challengeDisplayName` is merged in from the former `challenge_made` event
 * when the reveal was triggered by a challenge (Story 30.2).
 */
export const TurnRevealedPayloadSchema = z.object({
  card: TurnRevealedCardSchema,
  challengeDisplayName: z.string().optional(),
  challengeResult: z.enum(["challenger_wins", "challenger_loses"]).optional(),
  challengerId: z.uuid().optional(),
  expertVerificationDeadline: z.iso.datetime({ offset: true }).optional(),
  isCorrect: z.boolean(),
  platformBonusDeadline: z.iso.datetime({ offset: true }).optional(),
  platformOptions: z.array(PlatformOptionSchema).optional(),
  platformBonusPlayerId: z.uuid().optional(),
  position: z.number().int(),
  scores: z.record(z.string(), z.number().int()),
  timelines: z.record(z.string(), z.array(BroadcastTimelineEntrySchema)),
  tokens: z.record(z.string(), z.number().int()),
});

/**
 * Broadcast payload schema for the challenge_accepted event.
 */
export const ChallengeAcceptedPayloadSchema = z.object({
  acceptedCount: z.number().int(),
  totalRequired: z.number().int(),
  userId: z.uuid(),
});

/**
 * Broadcast payload schema for the platform_bonus_result event.
 */
export const PlatformBonusResultPayloadSchema = z.object({
  correct: z.boolean(),
  correctPlatforms: z.array(PlatformOptionSchema),
  scores: z.record(z.string(), z.number().int()),
  timelines: z.record(z.string(), z.array(BroadcastTimelineEntrySchema)),
  tokenChange: z.number().int(),
  tokens: z.record(z.string(), z.number().int()),
});

/**
 * Broadcast payload schema for the expert_verification_result event.
 */
export const ExpertVerificationResultPayloadSchema = z.object({
  correct: z.boolean(),
  correctPlatforms: z.array(PlatformOptionSchema),
  platformsCorrect: z.boolean(),
  scores: z.record(z.string(), z.number().int()),
  timelines: z.record(z.string(), z.array(BroadcastTimelineEntrySchema)),
  tokens: z.record(z.string(), z.number().int()),
  yearCorrect: z.boolean(),
});

/**
 * Broadcast payload schema for the turn_skipped event.
 */
export const TurnSkippedPayloadSchema = z.object({
  playerId: z.uuid(),
  reason: z.enum(["disconnect_timeout", "turn_timer_expired"]),
});

/**
 * Broadcast payload schema for the game_over event.
 */
export const GameOverPayloadSchema = z.object({
  displayName: z.string(),
  finalScores: z.record(z.string(), z.number().int()),
  finalTimelines: z.record(z.string(), z.array(BroadcastTimelineEntrySchema)),
  winnerId: z.uuid(),
});

/**
 * Broadcast payload schema for the team_vote_updated event.
 */
export const TeamVoteUpdatedPayloadSchema = z.object({
  votes: z.record(z.string(), z.object({ position: z.number().int(), locked: z.boolean() })),
});

/**
 * Broadcast payload schema for the team_vote_resolved event.
 */
export const TeamVoteResolvedPayloadSchema = z.object({
  card: TurnRevealedCardSchema,
  correct: z.boolean(),
  position: z.number().int(),
  teamScore: z.number().int(),
  teamTimeline: z.array(BroadcastTimelineEntrySchema),
  teamTokens: z.number().int(),
  voterBreakdown: z.record(z.string(), z.number().int()),
});

/**
 * Broadcast payload schema for the team_game_over event.
 */
export const TeamGameOverPayloadSchema = z.object({
  finalTeamScore: z.number().int(),
  finalTeamTimeline: z.array(BroadcastTimelineEntrySchema),
  teamWin: z.boolean(),
});

export type BroadcastTimelineEntry = z.infer<typeof BroadcastTimelineEntrySchema>;
export type ChallengeAcceptedPayload = z.infer<typeof ChallengeAcceptedPayloadSchema>;
export type TurnRevealedCard = z.infer<typeof TurnRevealedCardSchema>;

/**
 * Format a multiplayer turn phase for the page header.
 */
export function formatPhaseLabel(phase: MultiplayerGamePageData["currentTurn"]["phase"]): string {
  switch (phase) {
    case "challenge_window":
      return "Challenge Window";
    case "expert_verification":
      return "Expert Verification";
    case "platform_bonus":
      return "Platform Bonus";
    default:
      return phase.charAt(0).toUpperCase() + phase.slice(1);
  }
}

/**
 * Format a countdown value as mm:ss.
 */
export function formatCountdown(secondsRemaining: number): string {
  const minutes = Math.floor(secondsRemaining / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsRemaining % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Compute the remaining countdown seconds for a phase deadline.
 */
export function getCountdownSeconds(phaseDeadline: string | null): number | null {
  if (phaseDeadline === null) {
    return null;
  }

  const deadline = new Date(phaseDeadline).getTime();
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/**
 * Build a hidden current-turn card state from a screenshot id.
 */
export function buildHiddenTurnCard(
  screenshotImageId: string,
  gameId: number | null = null,
): MultiplayerTurnCard {
  return {
    coverImageId: null,
    gameId,
    isRevealed: false,
    platform: "",
    releaseYear: null,
    screenshotImageId,
    title: "?",
  };
}

/**
 * Convert a broadcast timeline entry into the client timeline card shape.
 */
export function buildTimelineCardFromEntry(entry: BroadcastTimelineEntry): MultiplayerTimelineCard {
  return {
    coverImageId: null,
    gameId: entry.gameId,
    isRevealed: true,
    platform: "Unknown",
    releaseYear: entry.releaseYear,
    screenshotImageId: null,
    title: entry.name,
  };
}

/**
 * Convert a revealed turn payload into the client timeline card shape.
 */
export function buildTimelineCardFromReveal(card: TurnRevealedCard): MultiplayerTimelineCard {
  return {
    coverImageId: card.coverImageId ?? null,
    gameId: card.gameId,
    isRevealed: true,
    platform: card.platform,
    releaseYear: card.releaseYear,
    screenshotImageId: card.screenshotImageId,
    title: card.name,
  };
}

/**
 * Insert the hidden current turn card into the active player's timeline.
 */
export function previewPlacement(
  players: readonly MultiplayerGamePagePlayer[],
  activePlayerId: string,
  position: number,
  card: MultiplayerTurnCard,
): MultiplayerGamePagePlayer[] {
  const hiddenCard: MultiplayerTimelineCard = {
    coverImageId: null,
    gameId: -1,
    isRevealed: false,
    platform: "",
    releaseYear: 0,
    screenshotImageId: card.screenshotImageId,
    title: "?",
  };

  return players.map((player) => {
    if (player.userId !== activePlayerId) {
      return player;
    }

    const timelineWithoutPending = player.timeline.filter(
      (timelineCard) => timelineCard.isRevealed,
    );
    const boundedPosition = Math.max(0, Math.min(position, timelineWithoutPending.length));
    return {
      ...player,
      timeline: [
        ...timelineWithoutPending.slice(0, boundedPosition),
        hiddenCard,
        ...timelineWithoutPending.slice(boundedPosition),
      ],
    };
  });
}

/**
 * Insert a revealed incorrect card briefly before removing it from the timeline.
 */
export function previewFailedReveal(
  players: readonly MultiplayerGamePagePlayer[],
  activePlayerId: string,
  position: number,
  card: TurnRevealedCard,
): MultiplayerGamePagePlayer[] {
  const revealedCard = buildTimelineCardFromReveal(card);

  return players.map((player) => {
    if (player.userId !== activePlayerId) {
      return player;
    }

    const timelineWithoutPending = player.timeline.filter(
      (timelineCard) => timelineCard.isRevealed,
    );
    const boundedPosition = Math.max(0, Math.min(position, timelineWithoutPending.length));
    return {
      ...player,
      timeline: [
        ...timelineWithoutPending.slice(0, boundedPosition),
        revealedCard,
        ...timelineWithoutPending.slice(boundedPosition),
      ],
    };
  });
}

/**
 * Reconcile broadcast scoreboard payloads into the local player state.
 */
export function reconcilePlayers(
  players: readonly MultiplayerGamePagePlayer[],
  timelines: Readonly<Record<string, readonly BroadcastTimelineEntry[]>>,
  scores: Readonly<Record<string, number>>,
  tokens: Readonly<Record<string, number>>,
  revealedCard: TurnRevealedCard | null,
): MultiplayerGamePagePlayer[] {
  return players.map((player) => {
    const nextTimeline = timelines[player.userId];
    const existingCardsByGameId = new Map(
      player.timeline.filter((card) => card.gameId >= 0).map((card) => [card.gameId, card]),
    );

    return {
      ...player,
      score: scores[player.userId] ?? player.score,
      timeline:
        nextTimeline?.map((entry) => {
          const existingCard = existingCardsByGameId.get(entry.gameId);
          if (existingCard !== undefined) {
            return {
              ...existingCard,
              isRevealed: true,
              releaseYear: entry.releaseYear,
              screenshotImageId: existingCard.screenshotImageId ?? null,
              title: entry.name,
            };
          }

          if (revealedCard?.gameId === entry.gameId) {
            return buildTimelineCardFromReveal(revealedCard);
          }

          return buildTimelineCardFromEntry(entry);
        }) ?? player.timeline,
      tokens: tokens[player.userId] ?? player.tokens,
    };
  });
}

/**
 * Check whether the supplied player currently appears in Presence.
 */
export function isPlayerConnected(
  connectedPlayers: readonly { userId: string }[],
  playerId: string,
): boolean {
  return connectedPlayers.some((player) => player.userId === playerId);
}

/**
 * Compute the initial `teamGameOver` state from the loaded game data.
 * Returns a payload when the game is already finished in teamwork mode
 * with no winner (team loss), otherwise null.
 */
export function getInitialTeamGameOver(game: MultiplayerGamePageData): TeamGameOverPayload | null {
  if (game.status !== "finished" || game.settings.gameMode !== "teamwork") return null;
  if (game.winner !== null) return null;
  return {
    finalTeamScore: game.teamScore ?? 0,
    finalTeamTimeline:
      game.teamTimeline?.map((card) => ({
        gameId: card.gameId,
        name: card.title,
        releaseYear: card.releaseYear,
      })) ?? [],
    teamWin: false,
  };
}
