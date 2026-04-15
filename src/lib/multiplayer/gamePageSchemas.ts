// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import { z } from "zod";
import { LobbyPlayerRoleSchema } from "./lobby";

/** @internal Validates a session ID path parameter. */
export const SessionIdSchema = z.uuid();

/** @internal Validates the game session status column. */
export const SessionStatusSchema = z.enum(["active", "finished", "abandoned"]);

/** @internal Validates a room_players row used for presence. */
export const RoomPlayerPresenceRowSchema = z.object({
  joined_at: z.iso.datetime({ offset: true }),
  role: LobbyPlayerRoleSchema,
  user_id: z.uuid(),
});

/** @internal Validates a game_players row. */
export const GamePlayerRowSchema = z.object({
  display_name: z.string(),
  score: z.number().int(),
  timeline: z.unknown(),
  tokens: z.number().int(),
  turn_position: z.number().int(),
  user_id: z.uuid(),
});

/** @internal Validates a game_sessions_safe row. */
export const GameSessionRowSchema = z.object({
  active_player_id: z.uuid().nullable(),
  current_turn: z.unknown().nullable(),
  id: z.uuid().nullable(),
  room_id: z.uuid().nullable(),
  settings: z.unknown().nullable(),
  status: SessionStatusSchema.nullable(),
  team_score: z.number().int().nullable().default(null),
  team_timeline: z.unknown().nullable().default(null),
  team_tokens: z.number().int().nullable().default(null),
  turn_number: z.number().int().nullable(),
  winner_id: z.uuid().nullable(),
});

/** @internal Validates a covers row. */
export const CoverRowSchema = z.object({
  game_id: z.number().int(),
  igdb_image_id: z.string(),
});

/** @internal Validates a game_platforms row. */
export const GamePlatformRowSchema = z.object({
  game_id: z.number().int(),
  platform_id: z.number().int(),
});

/** @internal Validates a platforms row. */
export const PlatformRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

/** @internal Validates a games row. */
export const GameRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  release_year: z.number().int(),
});
