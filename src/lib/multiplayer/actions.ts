"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { RoomCode } from "./lobby";
import {
  DEFAULT_LOBBY_SETTINGS,
  DisplayNameSchema,
  generateRoomCode,
  RoomCodeSchema,
} from "./lobby";
import {
  ensureRoomStillJoinable,
  findActiveRoomId,
  getAuthenticatedUserId,
  getRoomPlayerCount,
  isUniqueViolation,
  markRoomAbandoned,
  removeRoomMembership,
} from "./actionHelpers";
import { appError, fail, getFieldErrors, ok, type AppError, type Result } from "./actionResult";

const createRoomSchema = z.object({
  displayName: DisplayNameSchema,
});

const joinRoomSchema = z.object({
  code: RoomCodeSchema,
  displayName: DisplayNameSchema,
});

const leaveRoomSchema = z.object({
  roomId: z.uuid(),
});

const kickPlayerSchema = z.object({
  roomId: z.uuid(),
  targetUserId: z.uuid(),
});

const leaveRoomOutcomeSchema = z.enum([
  "abandoned",
  "left",
  "not_found",
  "not_member",
  "transferred",
  "unauthorized",
]);

const ROOM_CODE_RETRY_LIMIT = 3;

/**
 * Success payload returned by {@link createRoom}.
 */
export type CreateRoomResult = Readonly<{
  roomCode: RoomCode;
  roomId: string;
}>;

/**
 * Success payload returned by {@link joinRoom}.
 */
export type JoinRoomResult = Readonly<{
  roomId: string;
}>;

/**
 * Success payload returned by {@link leaveRoom}.
 */
export type LeaveRoomResult = Readonly<{
  roomId: string;
}>;

/**
 * Success payload returned by {@link kickPlayer}.
 */
export type KickPlayerResult = Readonly<{
  roomId: string;
  targetUserId: string;
}>;

function revalidateMultiplayerPaths(roomId: string): void {
  revalidatePath("/play");
  revalidatePath(`/play/lobby/${roomId}`);
}

/**
 * Create a multiplayer lobby room for the current authenticated or anonymous user.
 */
export async function createRoom(displayName: string): Promise<Result<CreateRoomResult, AppError>> {
  const parsed = createRoomSchema.safeParse({ displayName });
  if (!parsed.success) {
    return fail(
      appError(
        "VALIDATION_ERROR",
        "Please enter a valid display name before creating a room.",
        getFieldErrors(parsed.error),
      ),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const activeRoomResult = await findActiveRoomId(supabase, userIdResult.data);
  if (!activeRoomResult.success) {
    return activeRoomResult;
  }

  if (activeRoomResult.data !== null) {
    return fail(appError("CONFLICT", "You are already in an active room."));
  }

  for (let attempt = 0; attempt < ROOM_CODE_RETRY_LIMIT; attempt += 1) {
    const roomCode = generateRoomCode();
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code: roomCode,
        host_id: userIdResult.data,
        settings: DEFAULT_LOBBY_SETTINGS,
      })
      .select("id")
      .single();

    if (isUniqueViolation(roomError)) {
      continue;
    }

    if (roomError !== null) {
      return fail(appError("INTERNAL_ERROR", "Failed to create the room. Please try again."));
    }

    const { error: playerError } = await supabase.from("room_players").insert({
      room_id: room.id,
      user_id: userIdResult.data,
      display_name: parsed.data.displayName,
      role: "host",
    });

    if (playerError === null) {
      revalidateMultiplayerPaths(room.id);
      return ok({
        roomCode,
        roomId: room.id,
      });
    }

    const cleanupError = await markRoomAbandoned(supabase, room.id);
    if (cleanupError !== null) {
      return fail(cleanupError);
    }

    if (isUniqueViolation(playerError)) {
      return fail(appError("CONFLICT", "You are already in an active room."));
    }

    return fail(appError("INTERNAL_ERROR", "Failed to create the room. Please try again."));
  }

  return fail(appError("CONFLICT", "Could not generate an available room code. Please try again."));
}

/**
 * Join an existing multiplayer lobby room by six-character room code.
 */
export async function joinRoom(
  code: string,
  displayName: string,
): Promise<Result<JoinRoomResult, AppError>> {
  const parsed = joinRoomSchema.safeParse({ code, displayName });
  if (!parsed.success) {
    return fail(
      appError(
        "VALIDATION_ERROR",
        "Please provide a valid room code and display name before joining.",
        getFieldErrors(parsed.error),
      ),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, max_players")
    .eq("code", parsed.data.code)
    .eq("status", "lobby")
    .maybeSingle();

  if (roomError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to look up that room. Please try again."));
  }

  if (room === null) {
    return fail(appError("NOT_FOUND", "That room code does not match an open lobby."));
  }

  const activeRoomResult = await findActiveRoomId(supabase, userIdResult.data);
  if (!activeRoomResult.success) {
    return activeRoomResult;
  }

  if (activeRoomResult.data === room.id) {
    return fail(appError("CONFLICT", "You are already in this room."));
  }

  if (activeRoomResult.data !== null) {
    return fail(appError("CONFLICT", "You are already in another active room."));
  }

  const { error: insertError } = await supabase.from("room_players").insert({
    room_id: room.id,
    user_id: userIdResult.data,
    display_name: parsed.data.displayName,
  });

  if (insertError !== null) {
    if (isUniqueViolation(insertError)) {
      return fail(appError("CONFLICT", "You are already in this room."));
    }

    return fail(appError("INTERNAL_ERROR", "Failed to join the room. Please try again."));
  }

  const roomStatusResult = await ensureRoomStillJoinable(supabase, room.id);
  if (!roomStatusResult.success) {
    const cleanupError = await removeRoomMembership(supabase, room.id, userIdResult.data);
    return cleanupError === null ? roomStatusResult : fail(cleanupError);
  }

  if (!roomStatusResult.data) {
    const cleanupError = await removeRoomMembership(supabase, room.id, userIdResult.data);
    return cleanupError === null
      ? fail(appError("CONFLICT", "That room is no longer accepting new players."))
      : fail(cleanupError);
  }

  const playerCountResult = await getRoomPlayerCount(supabase, room.id);
  if (!playerCountResult.success) {
    const cleanupError = await removeRoomMembership(supabase, room.id, userIdResult.data);
    return cleanupError === null ? playerCountResult : fail(cleanupError);
  }

  if (playerCountResult.data > room.max_players) {
    const cleanupError = await removeRoomMembership(supabase, room.id, userIdResult.data);
    return cleanupError === null
      ? fail(appError("CONFLICT", "This room is full."))
      : fail(cleanupError);
  }

  revalidateMultiplayerPaths(room.id);
  return ok({ roomId: room.id });
}

/**
 * Leave a multiplayer lobby room and transfer host ownership when necessary.
 */
export async function leaveRoom(roomId: string): Promise<Result<LeaveRoomResult, AppError>> {
  const parsed = leaveRoomSchema.safeParse({ roomId });
  if (!parsed.success) {
    return fail(
      appError(
        "VALIDATION_ERROR",
        "Please provide a valid room before leaving.",
        getFieldErrors(parsed.error),
      ),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const { data, error } = await supabase.rpc("leave_room", {
    target_room_id: parsed.data.roomId,
  });
  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to leave the room. Please try again."));
  }

  const parsedOutcome = leaveRoomOutcomeSchema.safeParse(data);
  if (!parsedOutcome.success) {
    return fail(appError("INTERNAL_ERROR", "Failed to leave the room. Please try again."));
  }

  switch (parsedOutcome.data) {
    case "abandoned":
    case "left":
    case "transferred":
      revalidateMultiplayerPaths(parsed.data.roomId);
      return ok({ roomId: parsed.data.roomId });
    case "not_found":
      return fail(appError("NOT_FOUND", "That room no longer exists."));
    case "not_member":
      return fail(appError("CONFLICT", "You are not in that room."));
    case "unauthorized":
      return fail(
        appError("UNAUTHORIZED", "You must be signed in before using multiplayer rooms."),
      );
  }
}

/**
 * Remove a non-host player from a multiplayer lobby room as the current host.
 */
export async function kickPlayer(
  roomId: string,
  targetUserId: string,
): Promise<Result<KickPlayerResult, AppError>> {
  const parsed = kickPlayerSchema.safeParse({ roomId, targetUserId });
  if (!parsed.success) {
    return fail(
      appError(
        "VALIDATION_ERROR",
        "Please provide a valid room and player before kicking.",
        getFieldErrors(parsed.error),
      ),
    );
  }

  const supabase = await createClient();
  const userIdResult = await getAuthenticatedUserId(supabase);
  if (!userIdResult.success) {
    return userIdResult;
  }

  if (userIdResult.data === parsed.data.targetUserId) {
    return fail(appError("CONFLICT", "You cannot kick yourself out of the room."));
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("host_id")
    .eq("id", parsed.data.roomId)
    .maybeSingle();

  if (roomError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load that room. Please try again."));
  }

  if (room === null) {
    return fail(appError("NOT_FOUND", "That room no longer exists."));
  }

  if (room.host_id !== userIdResult.data) {
    return fail(appError("UNAUTHORIZED", "Only the host can remove players from this room."));
  }

  const { data: targetPlayer, error: targetPlayerError } = await supabase
    .from("room_players")
    .select("role")
    .eq("room_id", parsed.data.roomId)
    .eq("user_id", parsed.data.targetUserId)
    .maybeSingle();

  if (targetPlayerError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load that player. Please try again."));
  }

  if (targetPlayer === null) {
    return fail(appError("NOT_FOUND", "That player is not in this room."));
  }

  if (targetPlayer.role === "host") {
    return fail(appError("CONFLICT", "The host cannot be kicked from the room."));
  }

  const { error: deleteError } = await supabase
    .from("room_players")
    .delete()
    .eq("room_id", parsed.data.roomId)
    .eq("user_id", parsed.data.targetUserId);

  if (deleteError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to remove that player from the room."));
  }

  revalidateMultiplayerPaths(parsed.data.roomId);
  return ok({
    roomId: parsed.data.roomId,
    targetUserId: parsed.data.targetUserId,
  });
}
