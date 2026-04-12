import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";

const ACTIVE_ROOM_STATUSES = ["lobby", "playing"] as const;

/** Server Supabase client type used by multiplayer Server Actions. */
export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Check whether a Supabase error represents a unique-constraint violation. */
export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/** Verify auth with getUser() and return the authenticated user id. */
export async function getAuthenticatedUserId(
  supabase: SupabaseClient,
): Promise<Result<string, AppError>> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error !== null || user === null) {
    return fail(appError("UNAUTHORIZED", "You must be signed in before using multiplayer rooms."));
  }

  return ok(user.id);
}

/** Find the first active room membership for the supplied user id. */
export async function findActiveRoomId(
  supabase: SupabaseClient,
  userId: string,
): Promise<Result<string | null, AppError>> {
  const { data: memberships, error: membershipError } = await supabase
    .from("room_players")
    .select("room_id")
    .eq("user_id", userId);

  if (membershipError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to check your current room membership."));
  }

  const roomIds = [...new Set(memberships.map((membership) => membership.room_id))];
  if (roomIds.length === 0) {
    return ok(null);
  }

  const { data: activeRooms, error: activeRoomError } = await supabase
    .from("rooms")
    .select("id")
    .in("id", roomIds)
    .in("status", [...ACTIVE_ROOM_STATUSES])
    .limit(1);

  if (activeRoomError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to check your current room membership."));
  }

  return ok(activeRooms[0]?.id ?? null);
}

/** Mark a room abandoned after create-room cleanup fails partway through. */
export async function markRoomAbandoned(
  supabase: SupabaseClient,
  roomId: string,
): Promise<AppError | null> {
  const { error } = await supabase.from("rooms").update({ status: "abandoned" }).eq("id", roomId);

  return error === null
    ? null
    : appError("INTERNAL_ERROR", "Failed to clean up the room after creation failed.");
}

/** Remove a room membership that must be rolled back after a failed join attempt. */
export async function removeRoomMembership(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  return error === null
    ? null
    : appError("INTERNAL_ERROR", "Failed to clean up the room membership after join failed.");
}

/** Count current members in a room. */
export async function getRoomPlayerCount(
  supabase: SupabaseClient,
  roomId: string,
): Promise<Result<number, AppError>> {
  const { count, error } = await supabase
    .from("room_players")
    .select("user_id", { count: "exact", head: true })
    .eq("room_id", roomId);

  if (error !== null || count === null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the current room player count."));
  }

  return ok(count);
}

/** Confirm that a room is still in lobby status before allowing a join to stand. */
export async function ensureRoomStillJoinable(
  supabase: SupabaseClient,
  roomId: string,
): Promise<Result<boolean, AppError>> {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("status, max_players")
    .eq("id", roomId)
    .maybeSingle();

  if (error !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to confirm the room status before joining."));
  }

  return ok(room !== null && room.status === "lobby");
}
