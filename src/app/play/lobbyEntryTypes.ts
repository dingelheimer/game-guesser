// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import type { FieldErrors } from "@/lib/multiplayer/actionResult";
import { DisplayNameSchema, RoomCodeSchema } from "@/lib/multiplayer/lobby";

/** Validation schema for the "Create Room" form. */
export const createRoomFormSchema = z.object({
  displayName: DisplayNameSchema,
});

/** Validation schema for the "Join Room" form. */
export const joinRoomFormSchema = z.object({
  code: RoomCodeSchema,
  displayName: DisplayNameSchema,
});

/** Which dialog mode is active. */
export type LobbyEntryMode = "create" | "join";

/** Internal state for the lobby entry form. */
export type LobbyEntryState = Readonly<{
  displayName: string;
  roomCode: string;
  formError: string | null;
  fieldErrors: FieldErrors | undefined;
  conflictRoomId: string | null;
}>;

/** Normalise and constrain room code keyboard input. */
export function normalizeRoomCodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 6);
}

/** Display copy for each lobby entry dialog mode. */
export const LOBBY_ENTRY_COPY = {
  create: {
    title: "Create Room",
    description: "Pick the display name other players will see when they join your lobby.",
    submitLabel: "Create Room",
    pendingLabel: "Creating room…",
    errorMessage: "Please enter a valid display name before creating a room.",
  },
  join: {
    title: "Join Room",
    description: "Enter a room code and the display name you want to show in the lobby.",
    submitLabel: "Join Room",
    pendingLabel: "Joining room…",
    errorMessage: "Please provide a valid room code and display name before joining.",
  },
} as const;

/** Build the default form state for a fresh dialog open. */
export function buildInitialState(defaultDisplayName: string | null): LobbyEntryState {
  return {
    displayName: defaultDisplayName ?? "",
    roomCode: "",
    formError: null,
    fieldErrors: undefined,
    conflictRoomId: null,
  };
}
