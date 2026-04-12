"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "./actionHelpers";
import type { LobbySettings } from "./lobby";
import { LobbySettingsSchema } from "./lobby";
import { getAuthenticatedUserId, getRoomPlayerCount } from "./actionHelpers";
import { appError, fail, getFieldErrors, ok, type AppError, type Result } from "./actionResult";

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
    .select("host_id, status")
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

  const { data: updatedRoom, error } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", parsed.data.roomId)
    .eq("status", "lobby")
    .select("id")
    .maybeSingle();

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to start the game. Please try again."));
  }

  if (updatedRoom === null) {
    return fail(appError("CONFLICT", "This room is no longer in the lobby."));
  }

  revalidateMultiplayerPaths(parsed.data.roomId);
  return ok({
    gameSessionId: globalThis.crypto.randomUUID(),
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
