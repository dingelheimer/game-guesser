// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  DisplayNameSchema,
  LobbyPlayerRoleSchema,
  LobbySettingsSchema,
  RoomCodeSchema,
  type DisplayName,
  type LobbyGenre,
  type LobbyPlayerRole,
  type LobbySettings,
  type RoomCode,
} from "./lobby";

const LobbyRoomIdSchema = z.uuid();
const JoinedAtSchema = z.iso.datetime({ offset: true });

/**
 * Serializable player record used by the multiplayer lobby page.
 */
export type LobbyRoomPagePlayer = Readonly<{
  displayName: DisplayName;
  joinedAt: string;
  role: LobbyPlayerRole;
  userId: string;
}>;

export type { LobbyGenre };

/**
 * Serializable room payload loaded server-side for the multiplayer lobby page.
 */
export type LobbyRoomPageData = Readonly<{
  currentUserId: string;
  genres: readonly LobbyGenre[];
  hostId: string;
  maxPlayers: number;
  players: readonly LobbyRoomPagePlayer[];
  roomCode: RoomCode;
  roomId: string;
  settings: LobbySettings;
}>;

function parseLobbyRoomPlayer(row: {
  display_name: string;
  joined_at: string;
  role: string;
  user_id: string;
}): LobbyRoomPagePlayer {
  const displayName = DisplayNameSchema.safeParse(row.display_name);
  if (!displayName.success) {
    throw new Error("Encountered an invalid lobby player display name.");
  }

  const role = LobbyPlayerRoleSchema.safeParse(row.role);
  if (!role.success) {
    throw new Error("Encountered an invalid lobby player role.");
  }

  const joinedAt = JoinedAtSchema.safeParse(row.joined_at);
  if (!joinedAt.success) {
    throw new Error("Encountered an invalid lobby player join timestamp.");
  }

  return {
    displayName: displayName.data,
    joinedAt: joinedAt.data,
    role: role.data,
    userId: row.user_id,
  };
}

/**
 * Load the server-side room state required to render the multiplayer lobby page.
 */
export async function getLobbyRoomPageData(roomId: string): Promise<LobbyRoomPageData | null> {
  const parsedRoomId = LobbyRoomIdSchema.safeParse(roomId);
  if (!parsedRoomId.success) {
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

  const [
    { data: membership, error: membershipError },
    { data: room, error: roomError },
    { data: genreRows, error: genresError },
  ] = await Promise.all([
    supabase
      .from("room_players")
      .select("user_id")
      .eq("room_id", parsedRoomId.data)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("rooms")
      .select("id, code, host_id, max_players, settings, status")
      .eq("id", parsedRoomId.data)
      .maybeSingle(),
    supabase.from("genres").select("id, name").order("name", { ascending: true }),
  ]);

  if (membershipError !== null) {
    throw new Error("Failed to verify lobby membership.");
  }

  if (roomError !== null) {
    throw new Error("Failed to load the lobby room.");
  }

  if (genresError !== null) {
    throw new Error("Failed to load genres.");
  }

  if (membership === null || room === null || room.status !== "lobby") {
    return null;
  }

  const { data: players, error: playersError } = await supabase
    .from("room_players")
    .select("display_name, joined_at, role, user_id")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  if (playersError !== null) {
    throw new Error("Failed to load the lobby player list.");
  }

  const roomCode = RoomCodeSchema.safeParse(room.code);
  if (!roomCode.success) {
    throw new Error("Encountered an invalid multiplayer room code.");
  }

  const settings = LobbySettingsSchema.safeParse(room.settings);
  if (!settings.success) {
    throw new Error("Encountered invalid multiplayer room settings.");
  }

  return {
    currentUserId: user.id,
    genres: genreRows.map((g) => ({ id: g.id, name: g.name })),
    hostId: room.host_id,
    maxPlayers: room.max_players,
    players: players.map(parseLobbyRoomPlayer),
    roomCode: roomCode.data,
    roomId: room.id,
    settings: settings.data,
  };
}
