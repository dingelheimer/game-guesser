// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from "@supabase/realtime-js";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { claimHost } from "@/lib/multiplayer/hostActions";
import { createClient } from "@/lib/supabase/client";
import {
  LobbyPresenceSchema,
  LobbySettingsSchema,
  type LobbyPresence,
  type LobbySettings,
} from "@/lib/multiplayer/lobby";
import { buildConnectedPresence, buildSeedPresence } from "@/lib/multiplayer/presence";
import type { LobbyRoomPageData, LobbyRoomPagePlayer } from "@/lib/multiplayer/lobbyPage";

/** Grace period in seconds before host transfer is initiated on disconnect. */
const HOST_DISCONNECT_GRACE_SECONDS = 30;

const SettingsUpdatedPayloadSchema = LobbySettingsSchema;
const PlayerKickedPayloadSchema = z.object({ userId: z.uuid() });
const GameStartedPayloadSchema = z.object({
  sessionId: z.uuid(),
  turnOrder: z.array(z.uuid()),
  startingCards: z.record(
    z.uuid(),
    z.object({
      gameId: z.number().int(),
      releaseYear: z.number().int().nullable(),
      name: z.string(),
    }),
  ),
  firstCard: z.object({ screenshotImageId: z.string() }),
});
const HostTransferredPayloadSchema = z.object({ newHostId: z.uuid() });

/** State and helpers returned by {@link useLobbyRealtime}. */
export type LobbyRealtimeState = Readonly<{
  broadcast: (event: string, payload: Record<string, unknown>) => void;
  claimHostError: string | null;
  disconnectCountdown: number | null;
  hostId: string;
  isHost: boolean;
  isHostOnline: boolean;
  players: LobbyPresence[];
  setHostId: (hostId: string) => void;
  setSettings: (settings: LobbySettings) => void;
  settings: LobbySettings;
}>;

/**
 * Manages Supabase Realtime channel for the lobby: presence tracking,
 * broadcast listeners (settings, kicks, game start, host transfer),
 * disconnect grace countdown, and automatic host claiming.
 */
export function useLobbyRealtime(
  initialRoom: LobbyRoomPageData,
  currentPlayer: LobbyRoomPagePlayer,
): LobbyRealtimeState {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [players, setPlayers] = useState<LobbyPresence[]>(() =>
    buildSeedPresence(initialRoom.players),
  );
  const [hostId, setHostId] = useState(initialRoom.hostId);
  const [settings, setSettings] = useState<LobbySettings>(initialRoom.settings);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const [claimHostError, setClaimHostError] = useState<string | null>(null);

  const playersRef = useRef<LobbyPresence[]>(players);
  playersRef.current = players;
  const hostIdRef = useRef<string>(hostId);
  hostIdRef.current = hostId;
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHost = hostId === currentPlayer.userId;
  const isHostOnline = players.some((p) => p.userId === hostId);

  // Channel setup + broadcast listeners
  useEffect(() => {
    const channel = supabase.channel(`room:${initialRoom.roomId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: initialRoom.currentUserId },
      },
    });
    channelRef.current = channel;

    const syncPlayers = () => {
      setPlayers(
        buildConnectedPresence(
          initialRoom.players,
          channel.presenceState<Record<string, unknown>>(),
        ),
      );
    };

    channel
      .on("presence", { event: "sync" }, syncPlayers)
      .on("presence", { event: "join" }, syncPlayers)
      .on("presence", { event: "leave" }, syncPlayers)
      .on("broadcast", { event: "settings_updated" }, (msg) => {
        const payload: unknown = msg.payload;
        const parsed = SettingsUpdatedPayloadSchema.safeParse(payload);
        if (parsed.success) setSettings(parsed.data);
      })
      .on("broadcast", { event: "player_kicked" }, (msg) => {
        const payload: unknown = msg.payload;
        const parsed = PlayerKickedPayloadSchema.safeParse(payload);
        if (!parsed.success) return;
        if (parsed.data.userId === currentPlayer.userId) {
          toast.error("You were removed from the room by the host.");
          router.push("/play");
        }
      })
      .on("broadcast", { event: "game_started" }, (msg) => {
        const payload: unknown = msg.payload;
        const parsed = GameStartedPayloadSchema.safeParse(payload);
        if (!parsed.success) return;
        router.push(`/play/game/${parsed.data.sessionId}`);
      })
      .on("broadcast", { event: "host_transferred" }, (msg) => {
        const payload: unknown = msg.payload;
        const parsed = HostTransferredPayloadSchema.safeParse(payload);
        if (parsed.success) setHostId(parsed.data.newHostId);
      })
      .subscribe((status) => {
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) return;

        void channel.track(
          LobbyPresenceSchema.parse({
            userId: currentPlayer.userId,
            displayName: currentPlayer.displayName,
            role: currentPlayer.role,
            status: "connected",
            joinedAt: currentPlayer.joinedAt,
          }),
        );
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [currentPlayer, initialRoom.currentUserId, initialRoom.players, initialRoom.roomId, supabase]);

  // Disconnect grace countdown — starts when the host drops off Presence,
  // cancels when the host reconnects, and triggers claimHost on expiry.
  useEffect(() => {
    const clearCountdown = () => {
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setDisconnectCountdown(null);
    };

    if (isHostOnline || isHost) {
      clearCountdown();
      return;
    }

    if (countdownIntervalRef.current !== null) return;

    setDisconnectCountdown(HOST_DISCONNECT_GRACE_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setDisconnectCountdown((prev) => {
        const next = (prev ?? 0) - 1;
        if (next <= 0) {
          const id = countdownIntervalRef.current;
          if (id !== null) {
            clearInterval(id);
            countdownIntervalRef.current = null;
          }
          void handleClaimHost();
          return null;
        }
        return next;
      });
    }, 1000);

    return clearCountdown;
  }, [isHostOnline, isHost]);

  async function handleClaimHost(): Promise<void> {
    const onlineUserIds = playersRef.current.map((p) => p.userId);
    const result = await claimHost(initialRoom.roomId, onlineUserIds);

    if (!result.success) {
      if (result.error.code !== "CONFLICT") {
        setClaimHostError(result.error.message);
      }
      return;
    }

    void channelRef.current?.send({
      type: "broadcast",
      event: "host_transferred",
      payload: { newHostId: result.data.newHostId },
    });
    setHostId(result.data.newHostId);
  }

  /** Send a broadcast event on the lobby channel. */
  function broadcast(event: string, payload: Record<string, unknown>): void {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }

  return {
    broadcast,
    claimHostError,
    disconnectCountdown,
    hostId,
    isHost,
    isHostOnline,
    players,
    setHostId,
    setSettings,
    settings,
  };
}
