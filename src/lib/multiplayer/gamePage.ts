// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LobbySettingsSchema, DisplayNameSchema } from "./lobby";
import { buildPlatformLabel } from "./platformLabel";
import { TimelineEntrySchema, TurnPhaseSchema, TurnStateSchema } from "./deck";
import {
  CoverRowSchema,
  GamePlatformRowSchema,
  GamePlayerRowSchema,
  GameRowSchema,
  GameSessionRowSchema,
  PlatformRowSchema,
  RoomPlayerPresenceRowSchema,
  SessionIdSchema,
} from "./gamePageSchemas";
import { buildHiddenTurnCard, buildRevealedTurnCard } from "./gamePageTypes";
import type { MultiplayerGamePageData } from "./gamePageTypes";

export type {
  MultiplayerGamePageData,
  MultiplayerGamePagePlayer,
  MultiplayerTimelineCard,
  MultiplayerTurnCard,
} from "./gamePageTypes";

/**
 * Load the server-side data required to render the multiplayer game screen.
 */
export async function getMultiplayerGamePageData(
  sessionId: string,
): Promise<MultiplayerGamePageData | null> {
  const parsedSessionId = SessionIdSchema.safeParse(sessionId);
  if (!parsedSessionId.success) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError !== null || user === null) {
    return null;
  }

  const [{ data: sessionRow, error: sessionError }, { data: playerRows, error: playersError }] =
    await Promise.all([
      supabase
        .from("game_sessions_safe")
        .select(
          "id, room_id, status, current_turn, turn_number, active_player_id, winner_id, settings, team_timeline, team_tokens, team_score",
        )
        .eq("id", parsedSessionId.data)
        .maybeSingle(),
      supabase
        .from("game_players")
        .select("user_id, display_name, score, tokens, turn_position, timeline")
        .eq("game_session_id", parsedSessionId.data)
        .order("turn_position", { ascending: true }),
    ]);

  if (sessionError !== null) {
    throw new Error("Failed to load the multiplayer game session.");
  }

  if (playersError !== null) {
    throw new Error("Failed to load the multiplayer game players.");
  }

  if (sessionRow === null) {
    return null;
  }

  const session = GameSessionRowSchema.safeParse(sessionRow);
  if (!session.success) {
    throw new Error("Encountered an invalid multiplayer game session payload.");
  }

  if (
    session.data.id === null ||
    session.data.room_id === null ||
    session.data.turn_number === null ||
    session.data.current_turn === null
  ) {
    return null;
  }

  if (session.data.status !== "active" && session.data.status !== "finished") {
    return null;
  }

  const settings = LobbySettingsSchema.safeParse(session.data.settings ?? {});
  if (!settings.success) {
    throw new Error("Encountered invalid multiplayer game settings.");
  }

  const currentTurn = TurnStateSchema.safeParse(session.data.current_turn);
  if (!currentTurn.success) {
    throw new Error("Encountered an invalid multiplayer turn payload.");
  }

  const parsedTeamTimeline =
    session.data.team_timeline !== null
      ? z.array(TimelineEntrySchema).safeParse(session.data.team_timeline)
      : null;

  if (parsedTeamTimeline !== null && !parsedTeamTimeline.success) {
    throw new Error("Encountered an invalid multiplayer team timeline payload.");
  }

  const parsedPlayers = playerRows.map((playerRow) => {
    const player = GamePlayerRowSchema.safeParse(playerRow);
    if (!player.success) {
      throw new Error("Encountered an invalid multiplayer player payload.");
    }

    const displayName = DisplayNameSchema.safeParse(player.data.display_name);
    if (!displayName.success) {
      throw new Error("Encountered an invalid multiplayer player display name.");
    }

    const timeline = z.array(TimelineEntrySchema).safeParse(player.data.timeline);
    if (!timeline.success) {
      throw new Error("Encountered an invalid multiplayer player timeline.");
    }

    return {
      displayName: displayName.data,
      score: player.data.score,
      timeline: timeline.data,
      tokens: player.data.tokens,
      turnPosition: player.data.turn_position,
      userId: player.data.user_id,
    };
  });

  if (parsedPlayers.length === 0) {
    return null;
  }

  const { data: roomPlayerRows, error: roomPlayersError } = await supabase
    .from("room_players")
    .select("user_id, role, joined_at")
    .eq("room_id", session.data.room_id)
    .order("joined_at", { ascending: true });

  if (roomPlayersError !== null) {
    throw new Error("Failed to load multiplayer room presence data.");
  }

  const roomPlayers = roomPlayerRows.map((roomPlayerRow) => {
    const roomPlayer = RoomPlayerPresenceRowSchema.safeParse(roomPlayerRow);
    if (!roomPlayer.success) {
      throw new Error("Encountered an invalid multiplayer room player payload.");
    }

    return {
      joinedAt: roomPlayer.data.joined_at,
      role: roomPlayer.data.role,
      userId: roomPlayer.data.user_id,
    };
  });

  const roomPlayerByUserId = new Map(roomPlayers.map((player) => [player.userId, player]));
  const timelineGameIds = [
    ...new Set([
      ...parsedPlayers.flatMap((player) => player.timeline.map((entry) => entry.gameId)),
      ...(parsedTeamTimeline?.data ?? []).map((entry) => entry.gameId),
    ]),
  ];
  const shouldRevealCurrentTurnCard =
    session.data.status === "finished" ||
    currentTurn.data.phase === "revealing" ||
    currentTurn.data.phase === "platform_bonus" ||
    currentTurn.data.phase === "expert_verification" ||
    currentTurn.data.phase === "complete";
  const coverImageIdsByGameId = new Map<number, string>();
  const platformNamesByGameId = new Map<number, string[]>();

  if (timelineGameIds.length > 0) {
    const [
      { data: coverRows, error: coverError },
      { data: gamePlatformRows, error: gamePlatformError },
    ] = await Promise.all([
      supabase.from("covers").select("game_id, igdb_image_id").in("game_id", timelineGameIds),
      supabase.from("game_platforms").select("game_id, platform_id").in("game_id", timelineGameIds),
    ]);

    if (coverError !== null) {
      throw new Error("Failed to load multiplayer timeline cover art.");
    }

    if (gamePlatformError !== null) {
      throw new Error("Failed to load multiplayer timeline platform data.");
    }

    for (const coverRow of coverRows) {
      const cover = CoverRowSchema.safeParse(coverRow);
      if (!cover.success) {
        throw new Error("Encountered an invalid multiplayer cover payload.");
      }

      coverImageIdsByGameId.set(cover.data.game_id, cover.data.igdb_image_id);
    }

    const parsedGamePlatforms = gamePlatformRows.map((gamePlatformRow) => {
      const gamePlatform = GamePlatformRowSchema.safeParse(gamePlatformRow);
      if (!gamePlatform.success) {
        throw new Error("Encountered an invalid multiplayer game platform payload.");
      }

      return gamePlatform.data;
    });

    const platformIds = [
      ...new Set(parsedGamePlatforms.map((gamePlatform) => gamePlatform.platform_id)),
    ];

    if (platformIds.length > 0) {
      const { data: platformRows, error: platformError } = await supabase
        .from("platforms")
        .select("id, name")
        .in("id", platformIds);

      if (platformError !== null) {
        throw new Error("Failed to load multiplayer platform names.");
      }

      const platformNameById = new Map<number, string>();
      for (const platformRow of platformRows) {
        const platform = PlatformRowSchema.safeParse(platformRow);
        if (!platform.success) {
          throw new Error("Encountered an invalid multiplayer platform payload.");
        }

        platformNameById.set(platform.data.id, platform.data.name);
      }

      for (const gamePlatform of parsedGamePlatforms) {
        const platformName = platformNameById.get(gamePlatform.platform_id);
        if (platformName === undefined) {
          continue;
        }

        const existingNames = platformNamesByGameId.get(gamePlatform.game_id) ?? [];
        platformNamesByGameId.set(gamePlatform.game_id, [...existingNames, platformName]);
      }
    }
  }

  const players = parsedPlayers.map((player) => {
    const roomPlayer = roomPlayerByUserId.get(player.userId);
    if (roomPlayer === undefined) {
      throw new Error("Missing multiplayer room presence data for a game player.");
    }

    return {
      displayName: player.displayName,
      joinedAt: roomPlayer.joinedAt,
      role: roomPlayer.role,
      score: player.score,
      timeline: player.timeline.map((entry) => ({
        gameId: entry.gameId,
        coverImageId: coverImageIdsByGameId.get(entry.gameId) ?? null,
        isRevealed: true as const,
        platform: buildPlatformLabel(platformNamesByGameId.get(entry.gameId) ?? []),
        releaseYear: entry.releaseYear,
        screenshotImageId: null,
        title: entry.name,
      })),
      tokens: player.tokens,
      turnPosition: player.turnPosition,
      userId: player.userId,
    };
  });

  let currentTurnCard = buildHiddenTurnCard(
    currentTurn.data.gameId,
    currentTurn.data.screenshotImageId,
  );

  if (shouldRevealCurrentTurnCard) {
    const { data: currentGameRow, error: currentGameError } = await supabase
      .from("games")
      .select("id, name, release_year")
      .eq("id", currentTurn.data.gameId)
      .maybeSingle();

    if (currentGameError !== null || currentGameRow === null) {
      throw new Error("Failed to load the current multiplayer turn card.");
    }

    const currentGame = GameRowSchema.safeParse(currentGameRow);
    if (!currentGame.success) {
      throw new Error("Encountered an invalid current multiplayer turn card.");
    }

    currentTurnCard = buildRevealedTurnCard(
      currentGame.data,
      currentTurn.data.screenshotImageId,
      coverImageIdsByGameId.get(currentTurn.data.gameId) ?? null,
      buildPlatformLabel(platformNamesByGameId.get(currentTurn.data.gameId) ?? []),
    );
  }

  const winner =
    session.data.winner_id === null
      ? null
      : (() => {
          const winningPlayer = players.find((player) => player.userId === session.data.winner_id);
          if (winningPlayer === undefined) {
            throw new Error("Missing winner data for the finished multiplayer session.");
          }

          return {
            displayName: winningPlayer.displayName,
            userId: winningPlayer.userId,
          };
        })();

  return {
    currentTurn: {
      ...(currentTurn.data.acceptedPlayerIds !== undefined
        ? { acceptedPlayerIds: currentTurn.data.acceptedPlayerIds }
        : {}),
      activePlayerId:
        session.data.active_player_id ?? winner?.userId ?? currentTurn.data.activePlayerId,
      card: currentTurnCard,
      phase: TurnPhaseSchema.parse(currentTurn.data.phase),
      phaseDeadline: currentTurn.data.phaseDeadline ?? null,
      platformOptions: currentTurn.data.platformOptions ?? [],
      ...(currentTurn.data.platformBonusPlayerId === undefined
        ? {}
        : { platformBonusPlayerId: currentTurn.data.platformBonusPlayerId }),
      ...(currentTurn.data.votes !== undefined ? { votes: currentTurn.data.votes } : {}),
    },
    currentUserId: user.id,
    players,
    roomId: session.data.room_id,
    sessionId: session.data.id,
    settings: settings.data,
    status: session.data.status,
    teamScore: session.data.team_score,
    teamTimeline:
      parsedTeamTimeline?.data.map((entry) => ({
        gameId: entry.gameId,
        coverImageId: coverImageIdsByGameId.get(entry.gameId) ?? null,
        isRevealed: true as const,
        platform: buildPlatformLabel(platformNamesByGameId.get(entry.gameId) ?? []),
        releaseYear: entry.releaseYear,
        screenshotImageId: null,
        title: entry.name,
      })) ?? null,
    teamTokens: session.data.team_tokens,
    turnNumber: session.data.turn_number,
    winner,
  };
}
