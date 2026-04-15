// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import { z } from "zod";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import { TimelineEntrySchema, TurnStateSchema, type TimelineEntry, type TurnState } from "./deck";
import {
  CoverRowSchema,
  GamePlatformRowSchema,
  GamePlayerRowSchema,
  GameRowSchema,
  GameSessionRowSchema,
  PlatformRowSchema,
  type BoardState,
  type ServiceClient,
  type WritableGamePlayer,
  type WritableGameSession,
} from "./gameActionTypes";
import { LobbySettingsSchema } from "./lobby";
import { buildPlatformLabel } from "./platformLabel";
import type { RevealedTurnCard } from "./turns";

/** Load and validate the game session row, returning a typed writable snapshot. */
export async function loadWritableGameSession(
  serviceClient: ServiceClient,
  sessionId: string,
): Promise<Result<WritableGameSession, AppError>> {
  const { data, error } = await serviceClient
    .from("game_sessions")
    .select(
      "room_id, status, deck, deck_cursor, current_turn, turn_number, turn_order, active_player_id, settings, team_timeline, team_tokens, team_score",
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
  const teamTimeline =
    session.data.team_timeline !== null
      ? z.array(TimelineEntrySchema).safeParse(session.data.team_timeline)
      : null;
  if (
    session.data.status !== "active" ||
    session.data.active_player_id === null ||
    !settings.success ||
    !currentTurn.success ||
    (teamTimeline !== null && !teamTimeline.success)
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
    teamScore: session.data.team_score,
    teamTimeline: teamTimeline !== null ? teamTimeline.data : null,
    teamTokens: session.data.team_tokens,
    turnNumber: session.data.turn_number,
    turnOrder: session.data.turn_order,
  });
}

/** Load and validate a single game player row. */
export async function loadWritableGamePlayer(
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

/** Load and assemble the revealed card data for the current turn's game. */
export async function loadResolvedTurnCard(
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

/** Load all players in the session and build the aggregated scoreboard snapshot. */
export async function loadBoardState(
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
