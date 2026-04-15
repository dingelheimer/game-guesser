// SPDX-License-Identifier: AGPL-3.0-only
import type { RealtimePresenceState } from "@supabase/realtime-js";
import {
  LobbyPresenceSchema,
  type DisplayName,
  type LobbyPlayerRole,
  type LobbyPresence,
} from "./lobby";

/**
 * Minimal player identity required to seed and reconcile multiplayer Presence state.
 */
export type PresencePlayer = Readonly<{
  displayName: DisplayName;
  joinedAt: string;
  role: LobbyPlayerRole;
  userId: string;
}>;

/**
 * Build the optimistic seed Presence list used before realtime sync completes.
 */
export function buildSeedPresence(players: readonly PresencePlayer[]): LobbyPresence[] {
  return players.map((player) => ({
    userId: player.userId,
    displayName: player.displayName,
    role: player.role,
    status: "connected",
    joinedAt: player.joinedAt,
  }));
}

/**
 * Reconcile the raw Supabase Presence state into ordered multiplayer players.
 */
export function buildConnectedPresence(
  players: readonly PresencePlayer[],
  rawPresenceState: RealtimePresenceState<Record<string, unknown>>,
): LobbyPresence[] {
  const playerOrder = new Map(players.map((player, index) => [player.userId, index]));
  const playersByUserId = new Map(players.map((player) => [player.userId, player]));
  const connectedPlayers = new Map<string, LobbyPresence>();

  for (const presenceEntries of Object.values(rawPresenceState)) {
    for (const presenceEntry of presenceEntries) {
      const parsedPresence = LobbyPresenceSchema.safeParse(presenceEntry);
      if (!parsedPresence.success) {
        continue;
      }

      const player = playersByUserId.get(parsedPresence.data.userId);

      connectedPlayers.set(parsedPresence.data.userId, {
        ...parsedPresence.data,
        displayName: player?.displayName ?? parsedPresence.data.displayName,
        joinedAt: player?.joinedAt ?? parsedPresence.data.joinedAt,
        role: player?.role ?? parsedPresence.data.role,
      });
    }
  }

  return [...connectedPlayers.values()].sort((left, right) => {
    const leftIndex = playerOrder.get(left.userId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = playerOrder.get(right.userId) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
  });
}
