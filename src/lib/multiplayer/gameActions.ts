"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  buildPlatformOptions,
  checkPlatformGuess,
  getPlatformDisplayName,
  maxDistractorsNeeded,
  type PlatformOption,
} from "@/lib/platformBonus";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";
import { getAuthenticatedUserId, type SupabaseClient } from "./actionHelpers";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import { TurnStateSchema, TimelineEntrySchema, type TimelineEntry, type TurnState } from "./deck";
import { LobbySettingsSchema, type LobbySettings } from "./lobby";
import { buildPlatformLabel } from "./platformLabel";
import { sortPlayersByStanding } from "./rankings";
import {
  buildChallengeDeadline,
  buildPhaseDeadline,
  buildPlatformBonusDeadline,
  findTimelineInsertPosition,
  getNextTurnIndex,
  insertTimelineEntry,
  isPlacementCorrect,
  type ChallengeMadePayload,
  type ChallengeResult,
  type GameOverPayload,
  type PlacementMadePayload,
  type PlatformBonusResultPayload,
  type RevealedTurnCard,
  type TurnRevealedPayload,
  type TurnSkippedPayload,
  type TurnSkippedReason,
  type TurnStartedPayload,
} from "./turns";

const SubmitPlacementSchema = z.object({
  position: z.number().int().min(0),
  sessionId: z.uuid(),
});

const SessionIdSchema = z.object({
  sessionId: z.uuid(),
});

const SkipTurnSchema = z.object({
  presenceUserIds: z.array(z.uuid()).default([]),
  reason: z.enum(["disconnect_timeout", "turn_timer_expired"]).default("turn_timer_expired"),
  sessionId: z.uuid(),
});

const SubmitPlatformBonusSchema = z.object({
  selectedPlatformIds: z.array(z.number().int()),
  sessionId: z.uuid(),
});

const GameSessionRowSchema = z.object({
  active_player_id: z.uuid().nullable(),
  current_turn: z.unknown().nullable(),
  deck: z.array(z.number().int()),
  deck_cursor: z.number().int(),
  room_id: z.uuid(),
  settings: z.unknown().nullable(),
  status: z.enum(["active", "finished", "abandoned"]),
  turn_number: z.number().int(),
  turn_order: z.array(z.uuid()),
});

const GamePlayerRowSchema = z.object({
  display_name: z.string(),
  score: z.number().int(),
  timeline: z.unknown(),
  tokens: z.number().int(),
  turn_position: z.number().int(),
  user_id: z.uuid(),
});

const GameRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  release_year: z.number().int(),
});

const CoverRowSchema = z.object({
  game_id: z.number().int(),
  igdb_image_id: z.string(),
});

const ScreenshotRowSchema = z.object({
  igdb_image_id: z.string(),
});

const GamePlatformRowSchema = z.object({
  game_id: z.number().int(),
  platform_id: z.number().int(),
});

const PlatformRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

const PlatformIdRowSchema = z.object({
  platform_id: z.number().int(),
});

type ServiceClient = ReturnType<typeof createServiceClient>;

type WritableGameSession = Readonly<{
  activePlayerId: string;
  currentTurn: TurnState;
  deck: readonly number[];
  deckCursor: number;
  roomId: string;
  settings: LobbySettings;
  turnNumber: number;
  turnOrder: readonly string[];
}>;

type WritableGamePlayer = Readonly<{
  displayName: string;
  score: number;
  timeline: readonly TimelineEntry[];
  tokens: number;
  turnPosition: number;
  userId: string;
}>;

type BoardState = Readonly<
  Pick<TurnRevealedPayload, "scores" | "timelines" | "tokens"> & {
    players: readonly WritableGamePlayer[];
  }
>;

type PlatformBonusState = Readonly<{
  correctIds: readonly number[];
  correctPlatforms: readonly PlatformOption[];
  options: readonly PlatformOption[];
}>;

/**
 * Follow-up state returned after a multiplayer turn resolves or is skipped.
 */
export type TurnFollowUpResult =
  | Readonly<{ gameOver: GameOverPayload; type: "game_over" }>
  | Readonly<{ nextTurn: TurnStartedPayload; type: "next_turn" }>;

/**
 * Success payload returned by {@link resolveTurn}.
 */
export type ResolveTurnResult = Readonly<{
  followUp?: TurnFollowUpResult;
  reveal: TurnRevealedPayload;
}>;

/**
 * Success payload returned by {@link submitPlacement}.
 */
export type SubmitPlacementResult =
  | Readonly<{
      placement: PlacementMadePayload;
      type: "challenge_window";
    }>
  | Readonly<{
      followUp?: TurnFollowUpResult;
      placement: PlacementMadePayload;
      reveal: TurnRevealedPayload;
      type: "revealed";
    }>;

/**
 * Success payload returned by {@link submitChallenge}.
 */
export type SubmitChallengeResult = Readonly<{
  challenge: ChallengeMadePayload;
  followUp?: TurnFollowUpResult;
  reveal: TurnRevealedPayload;
}>;

/**
 * Success payload returned by {@link proceedFromChallenge}.
 */
export type ProceedFromChallengeResult = Readonly<{
  followUp?: TurnFollowUpResult;
  reveal: TurnRevealedPayload;
}>;

/**
 * Success payload returned by {@link submitPlatformBonus}.
 */
export type SubmitPlatformBonusResult = Readonly<{
  bonus: PlatformBonusResultPayload;
  followUp: TurnFollowUpResult;
}>;

/**
 * Success payload returned by {@link proceedFromPlatformBonus}.
 */
export type ProceedFromPlatformBonusResult = Readonly<{
  bonus: PlatformBonusResultPayload;
  followUp: TurnFollowUpResult;
}>;

/**
 * Success payload returned by {@link skipTurn}.
 */
export type SkipTurnResult = Readonly<{
  followUp: TurnFollowUpResult;
  skipped: TurnSkippedPayload;
}>;

function revalidateGamePath(sessionId: string): void {
  revalidatePath(`/play/game/${sessionId}`);
}

async function restoreGamePlayerState(
  serviceClient: ServiceClient,
  sessionId: string,
  userId: string,
  fields: Readonly<{
    score?: number;
    timeline?: readonly TimelineEntry[];
    tokens?: number;
  }>,
): Promise<boolean> {
  const payload: {
    score?: number;
    timeline?: Json;
    tokens?: number;
  } = {};
  if (fields.score !== undefined) {
    payload["score"] = fields.score;
  }
  if (fields.timeline !== undefined) {
    payload["timeline"] = fields.timeline as unknown as Json;
  }
  if (fields.tokens !== undefined) {
    payload["tokens"] = fields.tokens;
  }

  const { error } = await serviceClient
    .from("game_players")
    .update(payload)
    .eq("game_session_id", sessionId)
    .eq("user_id", userId);

  return error === null;
}

async function restoreChallengeToken(
  serviceClient: ServiceClient,
  sessionId: string,
  userId: string,
  tokens: number,
): Promise<boolean> {
  return restoreGamePlayerState(serviceClient, sessionId, userId, { tokens });
}

function buildCompletedTurn(turn: TurnState, extraFields: Partial<TurnState> = {}): TurnState {
  const { phaseDeadline, ...rest } = turn;
  void phaseDeadline;
  return {
    ...rest,
    ...extraFields,
    phase: "complete",
  };
}

async function ensureSessionMember(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<Result<true, AppError>> {
  const { data, error } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to verify your game session membership."));
  }

  return data === null
    ? fail(appError("NOT_FOUND", "That game session no longer exists."))
    : ok(true);
}

async function loadWritableGameSession(
  serviceClient: ServiceClient,
  sessionId: string,
): Promise<Result<WritableGameSession, AppError>> {
  const { data, error } = await serviceClient
    .from("game_sessions")
    .select(
      "room_id, status, deck, deck_cursor, current_turn, turn_number, turn_order, active_player_id, settings",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the current multiplayer turn."));
  }

  if (data === null) {
    return fail(appError("NOT_FOUND", "That game session no longer exists."));
  }

  const session = GameSessionRowSchema.safeParse(data);
  if (!session.success) {
    return fail(appError("INTERNAL_ERROR", "Encountered an invalid multiplayer game session."));
  }

  const settings = LobbySettingsSchema.safeParse(session.data.settings ?? {});
  const currentTurn = TurnStateSchema.safeParse(session.data.current_turn);
  if (
    session.data.status !== "active" ||
    session.data.active_player_id === null ||
    !settings.success ||
    !currentTurn.success
  ) {
    return fail(appError("CONFLICT", "This multiplayer game is no longer active."));
  }

  return ok({
    activePlayerId: session.data.active_player_id,
    currentTurn: currentTurn.data,
    deck: session.data.deck,
    deckCursor: session.data.deck_cursor,
    roomId: session.data.room_id,
    settings: settings.data,
    turnNumber: session.data.turn_number,
    turnOrder: session.data.turn_order,
  });
}

async function loadWritableGamePlayer(
  serviceClient: ServiceClient,
  sessionId: string,
  userId: string,
): Promise<Result<WritableGamePlayer, AppError>> {
  const { data, error } = await serviceClient
    .from("game_players")
    .select("user_id, display_name, score, tokens, turn_position, timeline")
    .eq("game_session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the current game player."));
  }

  if (data === null) {
    return fail(appError("NOT_FOUND", "That player is no longer part of this game."));
  }

  const player = GamePlayerRowSchema.safeParse(data);
  const timeline = z.array(TimelineEntrySchema).safeParse(data.timeline);
  if (!player.success || !timeline.success) {
    return fail(appError("INTERNAL_ERROR", "Encountered an invalid multiplayer player state."));
  }

  return ok({
    displayName: player.data.display_name,
    score: player.data.score,
    timeline: timeline.data,
    tokens: player.data.tokens,
    turnPosition: player.data.turn_position,
    userId: player.data.user_id,
  });
}

async function loadResolvedTurnCard(
  serviceClient: ServiceClient,
  currentTurn: TurnState,
): Promise<Result<RevealedTurnCard, AppError>> {
  const [
    { data: gameRow, error: gameError },
    { data: coverRow, error: coverError },
    { data: gamePlatformRows, error: gamePlatformError },
  ] = await Promise.all([
    serviceClient
      .from("games")
      .select("id, name, release_year")
      .eq("id", currentTurn.gameId)
      .maybeSingle(),
    serviceClient
      .from("covers")
      .select("game_id, igdb_image_id")
      .eq("game_id", currentTurn.gameId)
      .maybeSingle(),
    serviceClient
      .from("game_platforms")
      .select("game_id, platform_id")
      .eq("game_id", currentTurn.gameId),
  ]);

  if (gameError !== null || gameRow === null || gamePlatformError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the placed game card."));
  }

  const game = GameRowSchema.safeParse(gameRow);
  if (!game.success) {
    return fail(appError("INTERNAL_ERROR", "Encountered an invalid placed game payload."));
  }

  const parsedPlatforms: Array<z.infer<typeof GamePlatformRowSchema>> = [];
  for (const row of gamePlatformRows) {
    const parsedRow = GamePlatformRowSchema.safeParse(row);
    if (!parsedRow.success) {
      return fail(appError("INTERNAL_ERROR", "Encountered invalid multiplayer platform mappings."));
    }

    parsedPlatforms.push(parsedRow.data);
  }

  const platformIds = [...new Set(parsedPlatforms.map((row) => row.platform_id))];
  const { data: platformRows, error: platformError } =
    platformIds.length === 0
      ? { data: [], error: null }
      : await serviceClient.from("platforms").select("id, name").in("id", platformIds);

  if (platformError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the game's platform names."));
  }

  const parsedPlatformRows: Array<z.infer<typeof PlatformRowSchema>> = [];
  for (const row of platformRows) {
    const parsedRow = PlatformRowSchema.safeParse(row);
    if (!parsedRow.success) {
      return fail(
        appError("INTERNAL_ERROR", "Encountered an invalid multiplayer platform payload."),
      );
    }

    parsedPlatformRows.push(parsedRow.data);
  }

  const platformNameById = new Map(parsedPlatformRows.map((row) => [row.id, row.name]));
  const platformNames = parsedPlatforms.flatMap((row) => {
    const platformName = platformNameById.get(row.platform_id);
    return platformName === undefined ? [] : [platformName];
  });
  const cover =
    coverError === null && coverRow !== null ? CoverRowSchema.safeParse(coverRow) : null;

  return ok({
    coverImageId: cover !== null && cover.success ? cover.data.igdb_image_id : null,
    gameId: game.data.id,
    name: game.data.name,
    platform: buildPlatformLabel(platformNames),
    releaseYear: game.data.release_year,
    screenshotImageId: currentTurn.screenshotImageId,
  });
}

async function loadBoardState(
  serviceClient: ServiceClient,
  sessionId: string,
): Promise<Result<BoardState, AppError>> {
  const { data, error } = await serviceClient
    .from("game_players")
    .select("user_id, display_name, score, tokens, turn_position, timeline")
    .eq("game_session_id", sessionId)
    .order("turn_position", { ascending: true });

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the updated multiplayer scoreboard."));
  }

  const scores: Record<string, number> = {};
  const timelines: Record<string, readonly TimelineEntry[]> = {};
  const tokens: Record<string, number> = {};
  const players: WritableGamePlayer[] = [];

  for (const row of data) {
    const player = GamePlayerRowSchema.safeParse(row);
    const timeline = z.array(TimelineEntrySchema).safeParse(row.timeline);
    if (!player.success || !timeline.success) {
      return fail(
        appError("INTERNAL_ERROR", "Encountered an invalid multiplayer scoreboard payload."),
      );
    }

    scores[player.data.user_id] = player.data.score;
    timelines[player.data.user_id] = timeline.data;
    tokens[player.data.user_id] = player.data.tokens;
    players.push({
      displayName: player.data.display_name,
      score: player.data.score,
      timeline: timeline.data,
      tokens: player.data.tokens,
      turnPosition: player.data.turn_position,
      userId: player.data.user_id,
    });
  }

  return ok({ players, scores, timelines, tokens });
}

async function loadPlatformBonusState(
  serviceClient: ServiceClient,
  gameId: number,
  releaseYear?: number,
): Promise<Result<PlatformBonusState, AppError>> {
  const { data: correctPlatformRows, error: correctPlatformError } = await serviceClient
    .from("game_platforms")
    .select("platform_id")
    .eq("game_id", gameId);

  if (correctPlatformError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the correct platform bonus answers."));
  }

  const safeCorrectPlatformRows = Array.isArray(correctPlatformRows) ? correctPlatformRows : [];
  const correctPlatformIds = safeCorrectPlatformRows.flatMap((row) => {
    const parsedRow = PlatformIdRowSchema.safeParse(row);
    return parsedRow.success ? [parsedRow.data.platform_id] : [];
  });
  const uniqueCorrectPlatformIds = [...new Set(correctPlatformIds)];
  if (uniqueCorrectPlatformIds.length !== safeCorrectPlatformRows.length) {
    const allRowsParsed = safeCorrectPlatformRows.every(
      (row) => PlatformIdRowSchema.safeParse(row).success,
    );
    if (!allRowsParsed) {
      return fail(
        appError("INTERNAL_ERROR", "Encountered an invalid platform bonus answer payload."),
      );
    }
  }

  const { data: correctPlatformsRows, error: correctPlatformsError } =
    uniqueCorrectPlatformIds.length === 0
      ? { data: [], error: null }
      : await serviceClient.from("platforms").select("id, name").in("id", uniqueCorrectPlatformIds);

  if (correctPlatformsError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the correct platform bonus labels."));
  }

  const correctPlatformById = new Map<number, PlatformOption>();
  const safeCorrectPlatformsRows = Array.isArray(correctPlatformsRows) ? correctPlatformsRows : [];
  for (const row of safeCorrectPlatformsRows) {
    const parsedRow = PlatformRowSchema.safeParse(row);
    if (!parsedRow.success) {
      return fail(appError("INTERNAL_ERROR", "Encountered an invalid platform bonus label."));
    }

    correctPlatformById.set(parsedRow.data.id, {
      id: parsedRow.data.id,
      name: getPlatformDisplayName(parsedRow.data.name),
    });
  }

  const correctPlatforms = uniqueCorrectPlatformIds.flatMap((platformId) => {
    const platform = correctPlatformById.get(platformId);
    return platform === undefined ? [] : [platform];
  });
  if (releaseYear === undefined) {
    return ok({
      correctIds: uniqueCorrectPlatformIds,
      correctPlatforms,
      options: correctPlatforms,
    });
  }

  const distractorsNeeded = maxDistractorsNeeded(correctPlatforms.length);

  const fetchDistractors = async (halfRange: number): Promise<readonly PlatformOption[]> => {
    if (distractorsNeeded === 0) {
      return [];
    }

    const { data: eraGames, error: eraGamesError } = await serviceClient
      .from("games")
      .select("id")
      .gte("release_year", releaseYear - halfRange)
      .lte("release_year", releaseYear + halfRange)
      .neq("id", gameId);

    const safeEraGames = Array.isArray(eraGames) ? eraGames : [];
    if (eraGamesError !== null || safeEraGames.length === 0) {
      return [];
    }

    const eraGameIds = safeEraGames.flatMap((row) => (typeof row.id === "number" ? [row.id] : []));
    if (eraGameIds.length === 0) {
      return [];
    }

    const { data: candidateRows, error: candidateError } = await serviceClient
      .from("game_platforms")
      .select("platform_id")
      .in("game_id", eraGameIds);

    const safeCandidateRows = Array.isArray(candidateRows) ? candidateRows : [];
    if (candidateError !== null || safeCandidateRows.length === 0) {
      return [];
    }

    const candidatePlatformIds = safeCandidateRows.flatMap((row) => {
      const parsedRow = PlatformIdRowSchema.safeParse(row);
      return parsedRow.success ? [parsedRow.data.platform_id] : [];
    });
    const uniqueCandidateIds = [...new Set(candidatePlatformIds)].filter(
      (platformId) => !uniqueCorrectPlatformIds.includes(platformId),
    );

    if (uniqueCandidateIds.length === 0) {
      return [];
    }

    for (let index = uniqueCandidateIds.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = uniqueCandidateIds[index];
      const swap = uniqueCandidateIds[swapIndex];
      if (current !== undefined && swap !== undefined) {
        uniqueCandidateIds[index] = swap;
        uniqueCandidateIds[swapIndex] = current;
      }
    }

    const selectedIds = uniqueCandidateIds.slice(0, distractorsNeeded);
    const { data: platformRows, error: platformError } = await serviceClient
      .from("platforms")
      .select("id, name")
      .in("id", selectedIds);

    if (platformError !== null) {
      return [];
    }

    const platformById = new Map<number, PlatformOption>();
    const safePlatformRows = Array.isArray(platformRows) ? platformRows : [];
    for (const row of safePlatformRows) {
      const parsedRow = PlatformRowSchema.safeParse(row);
      if (parsedRow.success) {
        platformById.set(parsedRow.data.id, {
          id: parsedRow.data.id,
          name: getPlatformDisplayName(parsedRow.data.name),
        });
      }
    }

    return selectedIds.flatMap((platformId) => {
      const platform = platformById.get(platformId);
      return platform === undefined ? [] : [platform];
    });
  };

  let distractors = await fetchDistractors(5);
  const minimumDistractors = Math.max(0, 8 - correctPlatforms.length);
  if (distractors.length < minimumDistractors) {
    distractors = await fetchDistractors(15);
  }

  const optionsResult = buildPlatformOptions(correctPlatforms, distractors);
  return ok({
    correctIds: optionsResult.correctIds,
    correctPlatforms,
    options: optionsResult.options,
  });
}

function buildGameOverPayload(
  players: readonly WritableGamePlayer[],
  winnerId: string,
): Result<GameOverPayload, AppError> {
  const winner = players.find((player) => player.userId === winnerId);
  if (winner === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to find the winner for this multiplayer game."));
  }

  const finalScores: Record<string, number> = {};
  const finalTimelines: Record<string, readonly TimelineEntry[]> = {};
  for (const player of players) {
    finalScores[player.userId] = player.score;
    finalTimelines[player.userId] = player.timeline;
  }

  return ok({
    displayName: winner.displayName,
    finalScores,
    finalTimelines,
    winnerId: winner.userId,
  });
}

async function finishGame(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  players: readonly WritableGamePlayer[],
  winnerId: string,
  expectedPhase: TurnState["phase"],
): Promise<Result<GameOverPayload, AppError>> {
  const payloadResult = buildGameOverPayload(players, winnerId);
  if (!payloadResult.success) {
    return payloadResult;
  }

  const completedTurn = buildCompletedTurn(session.currentTurn);
  const { data: updatedSession, error: sessionError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: completedTurn as unknown as Json,
      status: "finished",
      winner_id: winnerId,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("status", "active")
    .eq("current_turn->>phase", expectedPhase)
    .select("id")
    .maybeSingle();

  if (sessionError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to finish the multiplayer game session."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This multiplayer game has already finished."));
  }

  const { data: updatedRoom, error: roomError } = await serviceClient
    .from("rooms")
    .update({ status: "finished" })
    .eq("id", session.roomId)
    .select("id")
    .maybeSingle();

  if (roomError !== null || updatedRoom === null) {
    return fail(appError("INTERNAL_ERROR", "Failed to finish the multiplayer room."));
  }

  return ok(payloadResult.data);
}

async function resolvePlatformBonusPhase(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  correct: boolean,
): Promise<Result<SubmitPlatformBonusResult, AppError>> {
  const platformBonusStateResult = await loadPlatformBonusState(
    serviceClient,
    session.currentTurn.gameId,
  );
  if (!platformBonusStateResult.success) {
    return platformBonusStateResult;
  }

  const isProVariant = session.settings.variant === "pro";
  const platformBonusPlayerId = session.currentTurn.platformBonusPlayerId ?? session.activePlayerId;
  let tokenChange = 0;
  let rollbackState: Readonly<{
    fields: Readonly<{
      score?: number;
      timeline?: readonly TimelineEntry[];
      tokens?: number;
    }>;
    userId: string;
  }> | null = null;

  if (correct && !isProVariant) {
    const activePlayerResult = await loadWritableGamePlayer(
      serviceClient,
      sessionId,
      platformBonusPlayerId,
    );
    if (!activePlayerResult.success) {
      return activePlayerResult;
    }

    const nextTokens = Math.min(5, activePlayerResult.data.tokens + 1);
    tokenChange = nextTokens - activePlayerResult.data.tokens;

    if (tokenChange > 0) {
      rollbackState = {
        fields: { tokens: activePlayerResult.data.tokens },
        userId: activePlayerResult.data.userId,
      };
      const { error: updateTokenError } = await serviceClient
        .from("game_players")
        .update({ tokens: nextTokens })
        .eq("game_session_id", sessionId)
        .eq("user_id", platformBonusPlayerId);

      if (updateTokenError !== null) {
        return fail(appError("INTERNAL_ERROR", "Failed to award the platform bonus token."));
      }
    }
  } else if (!correct && isProVariant) {
    const platformBonusPlayerResult = await loadWritableGamePlayer(
      serviceClient,
      sessionId,
      platformBonusPlayerId,
    );
    if (!platformBonusPlayerResult.success) {
      return platformBonusPlayerResult;
    }

    const updatedTimeline = platformBonusPlayerResult.data.timeline.filter(
      (entry) => entry.gameId !== session.currentTurn.gameId,
    );
    const updatedScore = Math.max(0, platformBonusPlayerResult.data.score - 1);
    rollbackState = {
      fields: {
        score: platformBonusPlayerResult.data.score,
        timeline: platformBonusPlayerResult.data.timeline,
      },
      userId: platformBonusPlayerResult.data.userId,
    };

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({
        score: updatedScore,
        timeline: updatedTimeline as unknown as Json,
      })
      .eq("game_session_id", sessionId)
      .eq("user_id", platformBonusPlayerId);

    if (updatePlayerError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to apply the PRO platform bonus penalty."));
    }
  }

  const completedTurn = buildCompletedTurn(session.currentTurn, {
    platformBonusCorrect: correct,
  });
  const { data: updatedSession, error: updateTurnError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: completedTurn as unknown as Json,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", "platform_bonus")
    .select("id")
    .maybeSingle();

  if (updateTurnError !== null) {
    if (rollbackState !== null) {
      await restoreGamePlayerState(
        serviceClient,
        sessionId,
        rollbackState.userId,
        rollbackState.fields,
      );
    }
    return fail(appError("INTERNAL_ERROR", "Failed to store the platform bonus result."));
  }

  if (updatedSession === null) {
    if (rollbackState !== null) {
      await restoreGamePlayerState(
        serviceClient,
        sessionId,
        rollbackState.userId,
        rollbackState.fields,
      );
    }
    return fail(appError("CONFLICT", "Another player already advanced this platform bonus."));
  }

  const boardResult = await loadBoardState(serviceClient, sessionId);
  if (!boardResult.success) {
    return boardResult;
  }

  const followUpResult = await buildFollowUpAfterReveal(
    serviceClient,
    sessionId,
    session,
    boardResult.data.players,
  );
  if (!followUpResult.success) {
    return followUpResult;
  }

  return ok({
    bonus: {
      correct,
      correctPlatforms: platformBonusStateResult.data.correctPlatforms,
      scores: boardResult.data.scores,
      timelines: boardResult.data.timelines,
      tokenChange,
      tokens: boardResult.data.tokens,
    },
    followUp: followUpResult.data,
  });
}

async function startNextTurn(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  expectedPhase: TurnState["phase"],
): Promise<Result<TurnStartedPayload, AppError>> {
  const nextTurnIndex = getNextTurnIndex(session.turnOrder, session.activePlayerId);
  const nextGameId = session.deck.at(session.deckCursor);
  if (nextTurnIndex === null || nextGameId === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to prepare the next multiplayer turn."));
  }

  const nextActivePlayerId = session.turnOrder[nextTurnIndex];
  if (nextActivePlayerId === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to find the next active player."));
  }

  const { data: screenshotRows, error: screenshotError } = await serviceClient
    .from("screenshots")
    .select("igdb_image_id")
    .eq("game_id", nextGameId)
    .neq("curation", "rejected")
    .order("sort_order", { ascending: true })
    .limit(1);

  if (screenshotError !== null || screenshotRows.length === 0) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the next multiplayer screenshot."));
  }

  const screenshot = ScreenshotRowSchema.safeParse(screenshotRows[0]);
  if (!screenshot.success) {
    return fail(
      appError("INTERNAL_ERROR", "Encountered an invalid multiplayer screenshot payload."),
    );
  }

  const deadline = buildPhaseDeadline(session.settings.turnTimer);
  const nextTurn: TurnState = {
    activePlayerId: nextActivePlayerId,
    gameId: nextGameId,
    phase: "placing",
    screenshotImageId: screenshot.data.igdb_image_id,
    ...(deadline !== null && { phaseDeadline: deadline }),
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      active_player_id: nextActivePlayerId,
      current_turn: nextTurn as unknown as Json,
      deck_cursor: session.deckCursor + 1,
      turn_number: session.turnNumber + 1,
    })
    .eq("id", sessionId)
    .eq("turn_number", session.turnNumber)
    .eq("current_turn->>phase", expectedPhase)
    .select("room_id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to advance to the next multiplayer turn."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This multiplayer turn has already moved on."));
  }

  return ok({
    activePlayerId: nextActivePlayerId,
    deadline,
    screenshot: { screenshotImageId: screenshot.data.igdb_image_id },
    turnNumber: session.turnNumber + 1,
  });
}

async function buildFollowUpAfterReveal(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
  players: readonly WritableGamePlayer[],
): Promise<Result<TurnFollowUpResult, AppError>> {
  const activePlayer = players.find((player) => player.userId === session.activePlayerId);
  if (activePlayer === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the active player's final score."));
  }

  const winnerByScore =
    activePlayer.score >= session.settings.winCondition
      ? activePlayer
      : (players.find(
          (player) =>
            player.userId !== session.activePlayerId &&
            player.score >= session.settings.winCondition,
        ) ?? null);

  if (winnerByScore !== null) {
    const gameOverResult = await finishGame(
      serviceClient,
      sessionId,
      session,
      players,
      winnerByScore.userId,
      "complete",
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({
      gameOver: gameOverResult.data,
      type: "game_over",
    });
  }

  if (session.deckCursor >= session.deck.length) {
    const winner = sortPlayersByStanding(players)[0];
    if (winner === undefined) {
      return fail(appError("INTERNAL_ERROR", "Failed to determine the multiplayer winner."));
    }

    const gameOverResult = await finishGame(
      serviceClient,
      sessionId,
      session,
      players,
      winner.userId,
      "complete",
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({
      gameOver: gameOverResult.data,
      type: "game_over",
    });
  }

  const nextTurnResult = await startNextTurn(serviceClient, sessionId, session, "complete");
  if (!nextTurnResult.success) {
    return nextTurnResult;
  }

  return ok({
    nextTurn: nextTurnResult.data,
    type: "next_turn",
  });
}

async function buildFollowUpAfterSkip(
  serviceClient: ServiceClient,
  sessionId: string,
  session: WritableGameSession,
): Promise<Result<TurnFollowUpResult, AppError>> {
  if (session.deckCursor >= session.deck.length) {
    const boardResult = await loadBoardState(serviceClient, sessionId);
    if (!boardResult.success) {
      return boardResult;
    }

    const winner = sortPlayersByStanding(boardResult.data.players)[0];
    if (winner === undefined) {
      return fail(appError("INTERNAL_ERROR", "Failed to determine the multiplayer winner."));
    }

    const gameOverResult = await finishGame(
      serviceClient,
      sessionId,
      session,
      boardResult.data.players,
      winner.userId,
      "placing",
    );
    if (!gameOverResult.success) {
      return gameOverResult;
    }

    return ok({
      gameOver: gameOverResult.data,
      type: "game_over",
    });
  }

  const nextTurnResult = await startNextTurn(serviceClient, sessionId, session, "placing");
  if (!nextTurnResult.success) {
    return nextTurnResult;
  }

  return ok({
    nextTurn: nextTurnResult.data,
    type: "next_turn",
  });
}

/**
 * Resolve the already-recorded multiplayer placement and return the reveal payload.
 */
export async function resolveTurn(sessionId: string): Promise<Result<ResolveTurnResult, AppError>> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (
    sessionResult.data.currentTurn.phase !== "revealing" ||
    sessionResult.data.currentTurn.placedPosition === undefined
  ) {
    return fail(appError("CONFLICT", "This multiplayer turn is not ready to reveal."));
  }

  const [playerResult, cardResult] = await Promise.all([
    loadWritableGamePlayer(serviceClient, parsed.data.sessionId, sessionResult.data.activePlayerId),
    loadResolvedTurnCard(serviceClient, sessionResult.data.currentTurn),
  ]);

  if (!playerResult.success) {
    return playerResult;
  }

  if (!cardResult.success) {
    return cardResult;
  }

  const isCorrect = isPlacementCorrect(
    playerResult.data.timeline,
    cardResult.data.releaseYear,
    sessionResult.data.currentTurn.placedPosition,
  );

  const challengerId = sessionResult.data.currentTurn.challengerId;
  const isProVariant = sessionResult.data.settings.variant === "pro";
  let challengeResult: ChallengeResult | undefined;
  let platformBonusPlayerId: string | undefined;

  if (isCorrect) {
    const updatedTimeline = insertTimelineEntry(
      playerResult.data.timeline,
      {
        gameId: cardResult.data.gameId,
        name: cardResult.data.name,
        releaseYear: cardResult.data.releaseYear,
      },
      sessionResult.data.currentTurn.placedPosition,
    );

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({
        score: playerResult.data.score + 1,
        timeline: updatedTimeline as unknown as Json,
      })
      .eq("game_session_id", parsed.data.sessionId)
      .eq("user_id", playerResult.data.userId);

    if (updatePlayerError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to save the resolved multiplayer turn."));
    }

    platformBonusPlayerId = sessionResult.data.activePlayerId;
    if (challengerId !== undefined) {
      challengeResult = "challenger_loses";
    }
  } else if (challengerId !== undefined) {
    const challengerResult = await loadWritableGamePlayer(
      serviceClient,
      parsed.data.sessionId,
      challengerId,
    );
    if (!challengerResult.success) {
      return challengerResult;
    }

    const challengerInsertPosition = findTimelineInsertPosition(
      challengerResult.data.timeline,
      cardResult.data.releaseYear,
    );
    const updatedTimeline = insertTimelineEntry(
      challengerResult.data.timeline,
      {
        gameId: cardResult.data.gameId,
        name: cardResult.data.name,
        releaseYear: cardResult.data.releaseYear,
      },
      challengerInsertPosition,
    );

    const { error: updatePlayerError } = await serviceClient
      .from("game_players")
      .update({
        score: challengerResult.data.score + 1,
        timeline: updatedTimeline as unknown as Json,
      })
      .eq("game_session_id", parsed.data.sessionId)
      .eq("user_id", challengerResult.data.userId);

    if (updatePlayerError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to award the successful challenge card."));
    }

    challengeResult = "challenger_wins";
    if (isProVariant) {
      platformBonusPlayerId = challengerResult.data.userId;
    }
  }

  const platformBonusEligible = platformBonusPlayerId !== undefined && (isProVariant || isCorrect);
  if (platformBonusEligible) {
    const platformBonusStateResult = await loadPlatformBonusState(
      serviceClient,
      cardResult.data.gameId,
      cardResult.data.releaseYear,
    );
    if (!platformBonusStateResult.success) {
      return platformBonusStateResult;
    }

    const platformBonusDeadline = buildPlatformBonusDeadline();
    const platformBonusTurn: TurnState = {
      ...sessionResult.data.currentTurn,
      ...(challengerId !== undefined ? { challengeResult, challengerId } : {}),
      isCorrect,
      phase: "platform_bonus",
      phaseDeadline: platformBonusDeadline,
      ...(platformBonusPlayerId === undefined ? {} : { platformBonusPlayerId }),
      platformOptions: [...platformBonusStateResult.data.options],
    };
    const { error: updateTurnError } = await serviceClient
      .from("game_sessions")
      .update({
        current_turn: platformBonusTurn as unknown as Json,
      })
      .eq("id", parsed.data.sessionId)
      .eq("turn_number", sessionResult.data.turnNumber)
      .eq("current_turn->>phase", "revealing");

    if (updateTurnError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to start the multiplayer platform bonus."));
    }

    const boardResult = await loadBoardState(serviceClient, parsed.data.sessionId);
    if (!boardResult.success) {
      return boardResult;
    }

    revalidateGamePath(parsed.data.sessionId);
    return ok({
      reveal: {
        card: cardResult.data,
        ...(challengeResult !== undefined ? { challengeResult } : {}),
        ...(challengerId !== undefined ? { challengerId } : {}),
        isCorrect,
        platformBonusDeadline,
        platformOptions: platformBonusStateResult.data.options,
        ...(platformBonusPlayerId === undefined ? {} : { platformBonusPlayerId }),
        position: sessionResult.data.currentTurn.placedPosition,
        scores: boardResult.data.scores,
        timelines: boardResult.data.timelines,
        tokens: boardResult.data.tokens,
      },
    });
  }

  const resolvedTurn = buildCompletedTurn(sessionResult.data.currentTurn, {
    ...(challengerId !== undefined ? { challengeResult, challengerId } : {}),
    isCorrect,
  });
  const { error: updateTurnError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: resolvedTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("current_turn->>phase", "revealing");

  if (updateTurnError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to store the multiplayer reveal result."));
  }

  const boardResult = await loadBoardState(serviceClient, parsed.data.sessionId);
  if (!boardResult.success) {
    return boardResult;
  }

  const followUpResult = await buildFollowUpAfterReveal(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
    boardResult.data.players,
  );
  if (!followUpResult.success) {
    return followUpResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    followUp: followUpResult.data,
    reveal: {
      card: cardResult.data,
      ...(challengeResult !== undefined ? { challengeResult } : {}),
      ...(challengerId !== undefined ? { challengerId } : {}),
      isCorrect,
      position: sessionResult.data.currentTurn.placedPosition,
      scores: boardResult.data.scores,
      timelines: boardResult.data.timelines,
      tokens: boardResult.data.tokens,
    },
  });
}

/**
 * Submit the active player's multiplayer placement and either open the challenge
 * window or immediately reveal the result.
 */
export async function submitPlacement(
  sessionId: string,
  position: number,
): Promise<Result<SubmitPlacementResult, AppError>> {
  const parsed = SubmitPlacementSchema.safeParse({ position, sessionId });
  if (!parsed.success) {
    return fail(
      appError("VALIDATION_ERROR", "Please choose a valid placement before submitting your turn."),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.activePlayerId !== userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "Only the active player can place this card."));
  }

  if (sessionResult.data.currentTurn.phase !== "placing") {
    return fail(appError("CONFLICT", "This multiplayer turn is no longer accepting placements."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline !== undefined &&
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() <= Date.now()
  ) {
    return fail(
      appError("CONFLICT", "The multiplayer turn timer expired before you placed the card."),
    );
  }

  const playerResult = await loadWritableGamePlayer(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data.activePlayerId,
  );
  if (!playerResult.success) {
    return playerResult;
  }

  if (parsed.data.position > playerResult.data.timeline.length) {
    return fail(appError("VALIDATION_ERROR", "That placement position is out of range."));
  }

  const updatedTurn: TurnState = {
    ...sessionResult.data.currentTurn,
    placedPosition: parsed.data.position,
    ...(sessionResult.data.settings.tokensEnabled
      ? {
          phase: "challenge_window" as const,
          phaseDeadline: buildChallengeDeadline(),
        }
      : {
          phase: "revealing" as const,
        }),
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: updatedTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("active_player_id", userIdResult.data)
    .eq("current_turn->>phase", "placing")
    .select("room_id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to save that multiplayer placement."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "This multiplayer turn was already submitted."));
  }

  const placementPayload: PlacementMadePayload = {
    activePlayerId: userIdResult.data,
    ...(updatedTurn.phaseDeadline !== undefined
      ? { challengeDeadline: updatedTurn.phaseDeadline }
      : {}),
    position: parsed.data.position,
  };

  if (sessionResult.data.settings.tokensEnabled) {
    revalidateGamePath(parsed.data.sessionId);
    return ok({
      placement: placementPayload,
      type: "challenge_window",
    });
  }

  const revealResult = await resolveTurn(parsed.data.sessionId);
  if (!revealResult.success) {
    return revealResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    type: "revealed",
    ...(revealResult.data.followUp === undefined ? {} : { followUp: revealResult.data.followUp }),
    placement: placementPayload,
    reveal: revealResult.data.reveal,
  });
}

/**
 * Spend one token to challenge the current placement and immediately reveal it.
 */
export async function submitChallenge(
  sessionId: string,
): Promise<Result<SubmitChallengeResult, AppError>> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "challenge_window") {
    return fail(appError("CONFLICT", "This multiplayer turn cannot be challenged right now."));
  }

  if (sessionResult.data.activePlayerId === userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "You cannot challenge your own placement."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() <= Date.now()
  ) {
    return fail(appError("CONFLICT", "The challenge window has already expired."));
  }

  if (sessionResult.data.currentTurn.challengerId !== undefined) {
    return fail(appError("CONFLICT", "Another player already challenged this placement."));
  }

  const challengerResult = await loadWritableGamePlayer(
    serviceClient,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!challengerResult.success) {
    return challengerResult;
  }

  if (challengerResult.data.tokens < 1) {
    return fail(appError("CONFLICT", "You need at least one token to challenge a placement."));
  }

  const { error: tokenError } = await serviceClient
    .from("game_players")
    .update({ tokens: challengerResult.data.tokens - 1 })
    .eq("game_session_id", parsed.data.sessionId)
    .eq("user_id", userIdResult.data)
    .gte("tokens", 1);

  if (tokenError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to spend your challenge token."));
  }

  const updatedTurn: TurnState = {
    ...sessionResult.data.currentTurn,
    challengerId: userIdResult.data,
    phase: "revealing",
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: updatedTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("current_turn->>phase", "challenge_window")
    .is("current_turn->challengerId", null)
    .select("id")
    .maybeSingle();

  if (updateError !== null) {
    const refunded = await restoreChallengeToken(
      serviceClient,
      parsed.data.sessionId,
      userIdResult.data,
      challengerResult.data.tokens,
    );
    return refunded
      ? fail(appError("INTERNAL_ERROR", "Failed to register your multiplayer challenge."))
      : fail(appError("INTERNAL_ERROR", "Failed to register the challenge and refund the token."));
  }

  if (updatedSession === null) {
    const refunded = await restoreChallengeToken(
      serviceClient,
      parsed.data.sessionId,
      userIdResult.data,
      challengerResult.data.tokens,
    );
    return refunded
      ? fail(appError("CONFLICT", "Another player already moved this multiplayer turn forward."))
      : fail(
          appError(
            "INTERNAL_ERROR",
            "The challenge window closed before your token could be refunded.",
          ),
        );
  }

  const revealResult = await resolveTurn(parsed.data.sessionId);
  if (!revealResult.success) {
    return revealResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    challenge: {
      challengerId: userIdResult.data,
      displayName: challengerResult.data.displayName,
    },
    ...(revealResult.data.followUp === undefined ? {} : { followUp: revealResult.data.followUp }),
    reveal: revealResult.data.reveal,
  });
}

/**
 * Advance a multiplayer challenge window with no challenger into the reveal phase.
 */
export async function proceedFromChallenge(
  sessionId: string,
): Promise<Result<ProceedFromChallengeResult, AppError>> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "challenge_window") {
    return fail(appError("CONFLICT", "This multiplayer turn is not waiting for a challenge."));
  }

  if (sessionResult.data.currentTurn.challengerId !== undefined) {
    return fail(appError("CONFLICT", "A player already challenged this placement."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() > Date.now()
  ) {
    return fail(appError("CONFLICT", "The challenge window has not expired yet."));
  }

  const updatedTurn: TurnState = {
    ...sessionResult.data.currentTurn,
    phase: "revealing",
  };

  const { data: updatedSession, error: updateError } = await serviceClient
    .from("game_sessions")
    .update({
      current_turn: updatedTurn as unknown as Json,
    })
    .eq("id", parsed.data.sessionId)
    .eq("turn_number", sessionResult.data.turnNumber)
    .eq("current_turn->>phase", "challenge_window")
    .is("current_turn->challengerId", null)
    .select("id")
    .maybeSingle();

  if (updateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to continue from the challenge window."));
  }

  if (updatedSession === null) {
    return fail(appError("CONFLICT", "Another player already advanced this multiplayer turn."));
  }

  const revealResult = await resolveTurn(parsed.data.sessionId);
  if (!revealResult.success) {
    return revealResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    ...(revealResult.data.followUp === undefined ? {} : { followUp: revealResult.data.followUp }),
    reveal: revealResult.data.reveal,
  });
}

/**
 * Validate the active player's platform selections and resolve the bonus phase.
 */
export async function submitPlatformBonus(
  sessionId: string,
  selectedPlatformIds: readonly number[],
): Promise<Result<SubmitPlatformBonusResult, AppError>> {
  const parsed = SubmitPlatformBonusSchema.safeParse({ selectedPlatformIds, sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please choose a valid platform bonus selection."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "platform_bonus") {
    return fail(appError("CONFLICT", "This multiplayer turn is not accepting platform guesses."));
  }

  const platformBonusPlayerId =
    sessionResult.data.currentTurn.platformBonusPlayerId ?? sessionResult.data.activePlayerId;
  if (platformBonusPlayerId !== userIdResult.data) {
    return fail(
      appError("UNAUTHORIZED", "Only the designated player can answer the platform bonus."),
    );
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() <= Date.now()
  ) {
    return fail(appError("CONFLICT", "The multiplayer platform bonus has already expired."));
  }

  const platformBonusStateResult = await loadPlatformBonusState(
    serviceClient,
    sessionResult.data.currentTurn.gameId,
  );
  if (!platformBonusStateResult.success) {
    return platformBonusStateResult;
  }

  const correctSelection =
    checkPlatformGuess(
      parsed.data.selectedPlatformIds,
      platformBonusStateResult.data.correctIds,
    ) === "correct";
  const bonusResult = await resolvePlatformBonusPhase(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
    correctSelection,
  );
  if (!bonusResult.success) {
    return bonusResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok(bonusResult.data);
}

/**
 * Resolve an expired platform bonus phase without awarding a token.
 */
export async function proceedFromPlatformBonus(
  sessionId: string,
): Promise<Result<ProceedFromPlatformBonusResult, AppError>> {
  const parsed = SessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "platform_bonus") {
    return fail(appError("CONFLICT", "This multiplayer turn is not waiting on a platform bonus."));
  }

  if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() > Date.now()
  ) {
    return fail(appError("CONFLICT", "The multiplayer platform bonus has not expired yet."));
  }

  const bonusResult = await resolvePlatformBonusPhase(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
    false,
  );
  if (!bonusResult.success) {
    return bonusResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok(bonusResult.data);
}

/**
 * Skip an expired placing phase and advance to the next multiplayer turn.
 */
export async function skipTurn(
  sessionId: string,
  options: Readonly<{
    presenceUserIds?: readonly string[];
    reason?: TurnSkippedReason;
  }> = {},
): Promise<Result<SkipTurnResult, AppError>> {
  const parsed = SkipTurnSchema.safeParse({
    presenceUserIds: [...(options.presenceUserIds ?? [])],
    reason: options.reason ?? "turn_timer_expired",
    sessionId,
  });
  if (!parsed.success) {
    return fail(appError("VALIDATION_ERROR", "Please provide a valid game session."));
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const membershipResult = await ensureSessionMember(
    supabase,
    parsed.data.sessionId,
    userIdResult.data,
  );
  if (!membershipResult.success) {
    return membershipResult;
  }

  const serviceClient = createServiceClient();
  const sessionResult = await loadWritableGameSession(serviceClient, parsed.data.sessionId);
  if (!sessionResult.success) {
    return sessionResult;
  }

  if (sessionResult.data.currentTurn.phase !== "placing") {
    return fail(appError("CONFLICT", "This multiplayer turn cannot be skipped right now."));
  }

  if (parsed.data.reason === "disconnect_timeout") {
    if (parsed.data.presenceUserIds.includes(sessionResult.data.activePlayerId)) {
      return fail(
        appError(
          "CONFLICT",
          "The active player reconnected before the disconnect grace period expired.",
        ),
      );
    }
  } else if (
    sessionResult.data.currentTurn.phaseDeadline === undefined ||
    new Date(sessionResult.data.currentTurn.phaseDeadline).getTime() > Date.now()
  ) {
    return fail(appError("CONFLICT", "That multiplayer turn has not expired yet."));
  }

  const followUpResult = await buildFollowUpAfterSkip(
    serviceClient,
    parsed.data.sessionId,
    sessionResult.data,
  );
  if (!followUpResult.success) {
    return followUpResult;
  }

  revalidateGamePath(parsed.data.sessionId);
  return ok({
    followUp: followUpResult.data,
    skipped: {
      playerId: sessionResult.data.activePlayerId,
      reason: parsed.data.reason,
    },
  });
}
