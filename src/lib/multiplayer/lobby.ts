import { z } from "zod";

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9_ ]+$/;

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Alphabet used for human-friendly multiplayer room codes. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Shared room code schema for multiplayer create/join flows. */
export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    ROOM_CODE_PATTERN,
    "Room code must be 6 characters using letters A-H, J-N, P-Z, and digits 2-9.",
  );

/** Shared lobby player role schema for membership and presence state. */
export const LobbyPlayerRoleSchema = z.enum(["host", "player"]);

/** Shared lobby settings schema for multiplayer room configuration. */
export const LobbySettingsSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard", "extreme"]).default("easy"),
  turnTimer: z.enum(["30", "60", "unlimited"]).default("60"),
  tokensEnabled: z.boolean().default(true),
  startingTokens: z.number().int().min(0).max(10).default(2),
  winCondition: z.number().int().min(5).max(20).default(10),
  variant: z.enum(["standard", "pro", "expert", "teamwork"]).default("standard"),
});

/** Shared display name schema for multiplayer lobby forms. */
export const DisplayNameSchema = z
  .string()
  .transform(collapseWhitespace)
  .pipe(
    z
      .string()
      .min(2, "Display name must be between 2 and 20 characters.")
      .max(20, "Display name must be between 2 and 20 characters.")
      .regex(
        DISPLAY_NAME_PATTERN,
        "Display name can only contain letters, numbers, spaces, and underscores.",
      ),
  );

/** Shared lobby presence status schema for realtime member state. */
export const LobbyPresenceStatusSchema = z.enum(["connected", "away"]);

/** Shared realtime presence payload schema for multiplayer lobby members. */
export const LobbyPresenceSchema = z.object({
  userId: z.uuid(),
  displayName: DisplayNameSchema,
  role: LobbyPlayerRoleSchema,
  status: LobbyPresenceStatusSchema,
  joinedAt: z.iso.datetime(),
});

/** Validated room code value derived from {@link RoomCodeSchema}. */
export type RoomCode = z.infer<typeof RoomCodeSchema>;

/** Multiplayer lobby player role derived from {@link LobbyPlayerRoleSchema}. */
export type LobbyPlayerRole = z.infer<typeof LobbyPlayerRoleSchema>;

/** Multiplayer lobby settings value derived from {@link LobbySettingsSchema}. */
export type LobbySettings = z.infer<typeof LobbySettingsSchema>;

/** Multiplayer display name value derived from {@link DisplayNameSchema}. */
export type DisplayName = z.infer<typeof DisplayNameSchema>;

/** Multiplayer lobby presence status derived from {@link LobbyPresenceStatusSchema}. */
export type LobbyPresenceStatus = z.infer<typeof LobbyPresenceStatusSchema>;

/** Multiplayer lobby presence payload derived from {@link LobbyPresenceSchema}. */
export type LobbyPresence = z.infer<typeof LobbyPresenceSchema>;

/** Default lobby settings applied to newly created multiplayer rooms. */
export const DEFAULT_LOBBY_SETTINGS = LobbySettingsSchema.parse({});

/** Generate a cryptographically secure six-character multiplayer room code. */
export function generateRoomCode(): RoomCode {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(6));
  const roomCode = Array.from(bytes, (byte) =>
    ROOM_CODE_ALPHABET.charAt(byte % ROOM_CODE_ALPHABET.length),
  ).join("");

  return RoomCodeSchema.parse(roomCode);
}
