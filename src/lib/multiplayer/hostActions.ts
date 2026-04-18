// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "./actionHelpers";
import type { LobbySettings, HouseRuleParams } from "./lobby";
import { LobbySettingsSchema } from "./lobby";
import { getAuthenticatedUserId, getRoomPlayerCount } from "./actionHelpers";
import { appError, fail, getFieldErrors, ok, type AppError, type Result } from "./actionResult";
import {
  buildDeck,
  difficultyToMaxRank,
  fisherYatesShuffle,
  type TimelineEntry,
  type TurnState,
} from "./deck";
import type { Json } from "@/types/supabase";

const updateSettingsSchema = z.object({
  roomId: z.uuid(),
  settings: LobbySettingsSchema,
});

const claimHostSchema = z.object({
  roomId: z.uuid(),
  presenceUserIds: z.array(z.uuid()),
});

const startGameSchema = z.object({
  roomId: z.uuid(),
});

type HostRoomState = Readonly<{
  hostId: string;
  status: string;
  settings: LobbySettings;
}>;

/**
 * Success payload returned by {@link updateSettings}.
 */
export type UpdateSettingsResult = Readonly<{
  roomId: string;
  settings: LobbySettings;
}>;

/**
 * Success payload returned by {@link startGame}.
 */
export type StartGameResult = Readonly<{
  gameSessionId: string;
  turnOrder: readonly string[];
  startingCards: Readonly<Record<string, TimelineEntry>>;
  firstCard: Readonly<{ screenshotImageId: string }>;
}>;

function revalidateMultiplayerPaths(roomId: string): void {
  revalidatePath("/play");
  revalidatePath(`/play/lobby/${roomId}`);
}

async function getRoomState(
  supabase: SupabaseClient,
  roomId: string,
): Promise<Result<HostRoomState, AppError>> {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("host_id, status, settings")
    .eq("id", roomId)
    .maybeSingle();

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load that room. Please try again."));
  }

  if (room === null) {
    return fail(appError("NOT_FOUND", "That room no longer exists."));
  }

  return ok({
    hostId: room.host_id,
    status: room.status,
    settings: LobbySettingsSchema.parse(room.settings ?? {}),
  });
}

/**
 * Update multiplayer lobby settings as the current room host.
 */
export async function updateSettings(
  roomId: string,
  settings: LobbySettings,
): Promise<Result<UpdateSettingsResult, AppError>> {
  const parsed = updateSettingsSchema.safeParse({ roomId, settings });
  if (!parsed.success) {
    return fail(
      appError(
        "VALIDATION_ERROR",
        "Please provide a valid room and settings before updating the lobby.",
        getFieldErrors(parsed.error),
      ),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const roomResult = await getRoomState(supabase, parsed.data.roomId);
  if (!roomResult.success) {
    return roomResult;
  }

  if (roomResult.data.hostId !== userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "Only the host can update room settings."));
  }

  const { error } = await supabase
    .from("rooms")
    .update({ settings: parsed.data.settings })
    .eq("id", parsed.data.roomId);

  if (error !== null) {
    return fail(
      appError("INTERNAL_ERROR", "Failed to update the room settings. Please try again."),
    );
  }

  revalidateMultiplayerPaths(parsed.data.roomId);
  return ok({
    roomId: parsed.data.roomId,
    settings: parsed.data.settings,
  });
}

/** Shared helper that writes screenshots query URL for the first turn card. */
async function fetchFirstTurnScreenshot(
  serviceClient: ReturnType<typeof createServiceClient>,
  firstTurnGameId: number,
): Promise<Result<string, AppError>> {
  const { data: screenshotRows, error: screenshotsError } = await serviceClient
    .from("screenshots")
    .select("game_id, igdb_image_id")
    .eq("game_id", firstTurnGameId)
    .neq("curation", "rejected")
    .order("sort_order", { ascending: true })
    .limit(1);

  if (screenshotsError !== null || screenshotRows.length === 0) {
    return fail(
      appError("INTERNAL_ERROR", "Failed to load the first turn screenshot. Please try again."),
    );
  }

  const firstScreenshotId = screenshotRows[0]?.igdb_image_id;
  if (firstScreenshotId === undefined) {
    return fail(appError("INTERNAL_ERROR", "First turn screenshot data missing."));
  }

  return ok(firstScreenshotId);
}

/** Initialises a TEAMWORK game session (1 shared starting card, team tokens = 5). */
async function startTeamworkGame(
  supabase: SupabaseClient,
  serviceClient: ReturnType<typeof createServiceClient>,
  roomId: string,
  deck: number[],
  turnOrder: string[],
  firstActivePlayerId: string,
  effectiveSettings: LobbySettings,
  roomPlayers: Array<{ user_id: string; display_name: string }>,
): Promise<Result<StartGameResult, AppError>> {
  const teamStartingGameId = deck[0];
  const firstTurnGameId = deck[1];

  if (teamStartingGameId === undefined || firstTurnGameId === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to prepare the first turn. Please try again."));
  }

  const { data: gameRows, error: gameRowsError } = await serviceClient
    .from("games")
    .select("id, name, release_year")
    .in("id", [teamStartingGameId, firstTurnGameId]);

  if (gameRowsError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load game data. Please try again."));
  }

  const gameById = new Map(gameRows.map((g) => [g.id, g]));

  const screenshotResult = await fetchFirstTurnScreenshot(serviceClient, firstTurnGameId);
  if (!screenshotResult.success) {
    return screenshotResult;
  }
  const firstScreenshotId = screenshotResult.data;

  const startingGame = gameById.get(teamStartingGameId);
  if (startingGame === undefined) {
    return fail(appError("INTERNAL_ERROR", "Team starting card data missing."));
  }

  const teamTimeline: TimelineEntry[] = [
    { gameId: teamStartingGameId, releaseYear: startingGame.release_year, name: startingGame.name },
  ];

  const { turnTimer } = effectiveSettings;
  const phaseDeadline =
    turnTimer !== "unlimited"
      ? new Date(Date.now() + parseInt(turnTimer, 10) * 1000).toISOString()
      : undefined;

  const firstTurnPhase = turnOrder.length > 1 ? "team_voting" : "placing";
  const currentTurn: TurnState = {
    phase: firstTurnPhase,
    activePlayerId: firstActivePlayerId,
    gameId: firstTurnGameId,
    screenshotImageId: firstScreenshotId,
    ...(firstTurnPhase === "team_voting" && { votes: {} }),
    ...(phaseDeadline !== undefined && { phaseDeadline }),
  };

  const { data: gameSession, error: sessionError } = await serviceClient
    .from("game_sessions")
    .insert({
      room_id: roomId,
      deck,
      deck_cursor: 2,
      current_turn: currentTurn as unknown as Json,
      turn_number: 1,
      turn_order: turnOrder,
      active_player_id: firstActivePlayerId,
      settings: effectiveSettings as unknown as Json,
      team_timeline: teamTimeline as unknown as Json,
      team_tokens: 5,
      team_score: 0,
    })
    .select("id")
    .single();

  if (sessionError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to create the game session. Please try again."));
  }

  const gameSessionId = gameSession.id;
  const playerByUserId = new Map(roomPlayers.map((p) => [p.user_id, p]));

  const gamePlayers = turnOrder.map((userId, index) => {
    const player = playerByUserId.get(userId);
    return {
      game_session_id: gameSessionId,
      user_id: userId,
      display_name: player?.display_name ?? userId,
      tokens: 0,
      score: 0,
      turn_position: index,
      timeline: [] as unknown as Json,
    };
  });

  const { error: playersError } = await serviceClient.from("game_players").insert(gamePlayers);

  if (playersError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to create player records. Please try again."));
  }

  const { data: updatedRoom, error: roomUpdateError } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", roomId)
    .eq("status", "lobby")
    .select("id")
    .maybeSingle();

  if (roomUpdateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to start the game. Please try again."));
  }

  if (updatedRoom === null) {
    return fail(appError("CONFLICT", "This room is no longer in the lobby."));
  }

  return ok({
    gameSessionId,
    turnOrder,
    startingCards: {},
    firstCard: { screenshotImageId: firstScreenshotId },
  });
}

/**
 * Mark a multiplayer lobby as playing and return a placeholder game session id.
 */
export async function startGame(roomId: string): Promise<Result<StartGameResult, AppError>> {
  const parsed = startGameSchema.safeParse({ roomId });
  if (!parsed.success) {
    return fail(
      appError(
        "VALIDATION_ERROR",
        "Please provide a valid room before starting the game.",
        getFieldErrors(parsed.error),
      ),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const roomResult = await getRoomState(supabase, parsed.data.roomId);
  if (!roomResult.success) {
    return roomResult;
  }

  if (roomResult.data.hostId !== userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "Only the host can start the game."));
  }

  const playerCountResult = await getRoomPlayerCount(supabase, parsed.data.roomId);
  if (!playerCountResult.success) {
    return playerCountResult;
  }

  if (playerCountResult.data < 2) {
    return fail(
      appError("VALIDATION_ERROR", "At least two players are required to start the game."),
    );
  }

  if (roomResult.data.status !== "lobby") {
    return fail(appError("CONFLICT", "This room is no longer in the lobby."));
  }

  // Fetch room players (user IDs + display names for turn order and player rows).
  const { data: roomPlayers, error: roomPlayersError } = await supabase
    .from("room_players")
    .select("user_id, display_name")
    .eq("room_id", parsed.data.roomId);

  if (roomPlayersError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the room players. Please try again."));
  }

  const serviceClient = createServiceClient();

  // Extract house rule filter params from room settings.
  const houseRules: HouseRuleParams = {
    genreLockId: roomResult.data.settings.genreLockId,
    consoleLockFamily: roomResult.data.settings.consoleLockFamily,
    decadeStart: roomResult.data.settings.decadeStart,
  };

  // If speed round is enabled, override the turn timer for this game session only.
  // The live rooms.settings row is NOT modified.
  const baseSettings: LobbySettings = roomResult.data.settings.speedRound
    ? { ...roomResult.data.settings, turnTimer: "10" }
    : roomResult.data.settings;
  const startingTokens =
    baseSettings.variant === "pro"
      ? 5
      : baseSettings.variant === "expert"
        ? 3
        : baseSettings.startingTokens;
  const effectiveSettings: LobbySettings =
    startingTokens === baseSettings.startingTokens
      ? baseSettings
      : { ...baseSettings, startingTokens };

  // Build shuffled deck of game IDs based on room difficulty + house rules.
  let deck: number[];
  try {
    deck = await buildDeck(serviceClient, effectiveSettings.difficulty, houseRules);
  } catch {
    return fail(appError("INTERNAL_ERROR", "Failed to build the game deck. Please try again."));
  }

  // Deck must have at least 2 cards minimum (1 starting + 1 first turn) in TEAMWORK,
  // or N+1 cards in competitive (one starting card per player + first turn card).
  const playerCount = roomPlayers.length;
  const isTeamwork = effectiveSettings.gameMode === "teamwork";
  const minDeckSize = isTeamwork ? 2 : playerCount + 1;
  if (deck.length < minDeckSize) {
    return fail(
      appError(
        "INTERNAL_ERROR",
        "Not enough games are available for this difficulty. Try a different difficulty setting.",
      ),
    );
  }

  // Randomise turn order using Fisher-Yates.
  const turnOrder = fisherYatesShuffle(roomPlayers.map((p) => p.user_id));
  const firstActivePlayerId = turnOrder.at(0);
  if (firstActivePlayerId === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to prepare the first turn. Please try again."));
  }

  if (isTeamwork) {
    return startTeamworkGame(
      supabase,
      serviceClient,
      parsed.data.roomId,
      deck,
      turnOrder,
      firstActivePlayerId,
      effectiveSettings,
      roomPlayers,
    );
  }

  // Deal one starting card per player; the next card is the first active turn card.
  const startingGameIds = deck.slice(0, playerCount);
  const firstTurnGameId = deck.at(playerCount);
  if (firstTurnGameId === undefined) {
    return fail(appError("INTERNAL_ERROR", "Failed to prepare the first turn. Please try again."));
  }

  // Fetch metadata for all starting cards + the first turn card in one query.
  const allGameIds = [...startingGameIds, firstTurnGameId];
  const { data: gameRows, error: gameRowsError } = await serviceClient
    .from("games")
    .select("id, name, release_year")
    .in("id", allGameIds);

  if (gameRowsError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load game data. Please try again."));
  }

  const gameById = new Map(gameRows.map((g) => [g.id, g]));

  // Fetch the screenshot for the first turn card using the shared helper.
  const screenshotResult = await fetchFirstTurnScreenshot(serviceClient, firstTurnGameId);
  if (!screenshotResult.success) {
    return screenshotResult;
  }
  const firstScreenshotId = screenshotResult.data;

  // Build starting-card timeline entries, keyed by user ID.
  const playerByUserId = new Map(roomPlayers.map((p) => [p.user_id, p]));
  const startingCards: Record<string, TimelineEntry> = {};

  for (let i = 0; i < turnOrder.length; i++) {
    const userId = turnOrder.at(i);
    const gameId = startingGameIds.at(i);
    if (userId === undefined || gameId === undefined) continue;
    const game = gameById.get(gameId);
    if (game === undefined) continue;

    startingCards[userId] = {
      gameId,
      releaseYear: game.release_year,
      name: game.name,
    };
  }

  // Compute phase deadline from effective turn timer (speed round may override it).
  const { turnTimer } = effectiveSettings;
  const phaseDeadline =
    turnTimer !== "unlimited"
      ? new Date(Date.now() + parseInt(turnTimer, 10) * 1000).toISOString()
      : undefined;

  const firstTurnGame = gameById.get(firstTurnGameId);
  if (firstTurnGame === undefined) {
    return fail(appError("INTERNAL_ERROR", "First turn card data missing."));
  }

  const currentTurn: TurnState = {
    phase: "placing",
    activePlayerId: firstActivePlayerId,
    gameId: firstTurnGameId,
    screenshotImageId: firstScreenshotId,
    ...(phaseDeadline !== undefined && { phaseDeadline }),
  };

  // Insert game session row (service role — bypasses RLS).
  const { data: gameSession, error: sessionError } = await serviceClient
    .from("game_sessions")
    .insert({
      room_id: parsed.data.roomId,
      deck,
      deck_cursor: playerCount + 1,
      current_turn: currentTurn as unknown as Json,
      turn_number: 1,
      turn_order: turnOrder,
      active_player_id: firstActivePlayerId,
      settings: effectiveSettings as unknown as Json,
    })
    .select("id")
    .single();

  if (sessionError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to create the game session. Please try again."));
  }

  const gameSessionId = gameSession.id;

  // Insert one game_players row per player (service role — bypasses RLS).
  const gamePlayers = turnOrder.map((userId, index) => {
    const player = playerByUserId.get(userId);
    const startingCard = startingCards[userId];
    const timeline: TimelineEntry[] = startingCard !== undefined ? [startingCard] : [];

    return {
      game_session_id: gameSessionId,
      user_id: userId,
      display_name: player?.display_name ?? userId,
      tokens: startingTokens,
      score: 0,
      turn_position: index,
      timeline: timeline as unknown as Json,
    };
  });

  const { error: playersError } = await serviceClient.from("game_players").insert(gamePlayers);

  if (playersError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to create player records. Please try again."));
  }

  // Flip room status to playing (optimistic lock — ensures only one start succeeds).
  const { data: updatedRoom, error: roomUpdateError } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", parsed.data.roomId)
    .eq("status", "lobby")
    .select("id")
    .maybeSingle();

  if (roomUpdateError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to start the game. Please try again."));
  }

  if (updatedRoom === null) {
    return fail(appError("CONFLICT", "This room is no longer in the lobby."));
  }

  return ok({
    gameSessionId,
    turnOrder,
    startingCards,
    firstCard: { screenshotImageId: firstScreenshotId },
  });
}

/** Zod schema for the JSONB returned by the claim_host RPC. */
const claimHostRpcResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("transferred"), new_host_id: z.uuid() }),
  z.object({ status: z.literal("unauthorized") }),
  z.object({ status: z.literal("not_found") }),
  z.object({ status: z.literal("not_member") }),
  z.object({ status: z.literal("already_host") }),
  z.object({ status: z.literal("host_changed") }),
  z.object({ status: z.literal("no_players") }),
]);

/**
 * Success payload returned by {@link claimHost}.
 */
export type ClaimHostResult = Readonly<{
  newHostId: string;
}>;

/**
 * Transfer host ownership after the current host has disconnected and the
 * grace period has expired. The caller supplies the current Presence user IDs
 * so the server can verify the host is actually offline before transferring.
 */
export async function claimHost(
  roomId: string,
  presenceUserIds: readonly string[],
): Promise<Result<ClaimHostResult, AppError>> {
  const parsed = claimHostSchema.safeParse({ roomId, presenceUserIds: [...presenceUserIds] });
  if (!parsed.success) {
    return fail(
      appError(
        "VALIDATION_ERROR",
        "Please provide a valid room before claiming host.",
        getFieldErrors(parsed.error),
      ),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const roomResult = await getRoomState(supabase, parsed.data.roomId);
  if (!roomResult.success) {
    return roomResult;
  }

  if (parsed.data.presenceUserIds.includes(roomResult.data.hostId)) {
    return fail(appError("CONFLICT", "The host is still connected — no transfer needed."));
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc("claim_host", {
    target_room_id: parsed.data.roomId,
    expected_host_id: roomResult.data.hostId,
  });

  if (rpcError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to transfer host. Please try again."));
  }

  const parsedRpc = claimHostRpcResultSchema.safeParse(rpcResult);
  if (!parsedRpc.success) {
    return fail(appError("INTERNAL_ERROR", "Unexpected response from host transfer."));
  }

  switch (parsedRpc.data.status) {
    case "transferred":
      revalidateMultiplayerPaths(parsed.data.roomId);
      return ok({ newHostId: parsedRpc.data.new_host_id });
    case "host_changed":
      return fail(appError("CONFLICT", "Host was already transferred."));
    case "already_host":
      return fail(appError("UNAUTHORIZED", "You are already the host."));
    case "not_member":
      return fail(appError("UNAUTHORIZED", "You are not a member of this room."));
    case "not_found":
      return fail(appError("NOT_FOUND", "That room no longer exists."));
    case "no_players":
      return fail(appError("CONFLICT", "No players are available to become host."));
    case "unauthorized":
      return fail(appError("UNAUTHORIZED", "You must be signed in to claim host."));
  }
}

/**
 * Estimate the number of eligible games for the given difficulty and house rules.
 * Returns null when the user is not authenticated or the RPC call fails.
 */
export async function getDeckSize(
  difficulty: LobbySettings["difficulty"],
  houseRules: HouseRuleParams,
): Promise<number | null> {
  const supabase = await createClient();

  const maxRank = difficultyToMaxRank(difficulty);
  const rpcArgs: Record<string, unknown> = { p_max_rank: maxRank };
  if (houseRules.genreLockId != null) rpcArgs["p_genre_id"] = houseRules.genreLockId;
  if (houseRules.consoleLockFamily != null)
    rpcArgs["p_platform_family"] = houseRules.consoleLockFamily;
  if (houseRules.decadeStart != null) rpcArgs["p_decade_start"] = houseRules.decadeStart;

  const { data, error } = await supabase.rpc(
    // @ts-expect-error estimate_deck_size not yet in generated types
    "estimate_deck_size",
    rpcArgs,
  );

  if (error !== null || typeof data !== "number") return null;
  return data;
}
