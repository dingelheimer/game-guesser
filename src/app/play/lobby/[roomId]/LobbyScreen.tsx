// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from "@supabase/realtime-js";
import { Copy, Loader2, LogOut, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { kickPlayer, leaveRoom } from "@/lib/multiplayer/actions";
import { claimHost, getDeckSize, startGame, updateSettings } from "@/lib/multiplayer/hostActions";
import { createClient } from "@/lib/supabase/client";
import {
  LobbyPresenceSchema,
  LobbySettingsSchema,
  type LobbyPresence,
  type LobbySettings,
  type HouseRuleParams,
} from "@/lib/multiplayer/lobby";
import { buildConnectedPresence, buildSeedPresence } from "@/lib/multiplayer/presence";
import type { LobbyRoomPageData } from "@/lib/multiplayer/lobbyPage";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LobbyHostControls } from "./LobbyHostControls";
import { LobbyPlayerList } from "./LobbyPlayerList";
import { LobbySettingsPanel } from "./LobbySettingsPanel";

/** Grace period in seconds before host transfer is initiated on disconnect. */
const HOST_DISCONNECT_GRACE_SECONDS = 30;

/** Broadcast payload schema for the settings_updated event. */
const SettingsUpdatedPayloadSchema = LobbySettingsSchema;

/** Broadcast payload schema for the player_kicked event. */
const PlayerKickedPayloadSchema = z.object({ userId: z.uuid() });

/** Broadcast payload schema for the game_started event. */
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

/** Broadcast payload schema for the host_transferred event. */
const HostTransferredPayloadSchema = z.object({ newHostId: z.uuid() });

/**
 * Props for the multiplayer lobby client screen.
 */
export type LobbyScreenProps = Readonly<{
  initialRoom: LobbyRoomPageData;
}>;

/**
 * Client-side realtime multiplayer lobby screen.
 */
export function LobbyScreen({ initialRoom }: LobbyScreenProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentPlayer = useMemo(
    () => initialRoom.players.find((player) => player.userId === initialRoom.currentUserId),
    [initialRoom.currentUserId, initialRoom.players],
  );
  const [players, setPlayers] = useState<LobbyPresence[]>(() =>
    buildSeedPresence(initialRoom.players),
  );
  const [hostId, setHostId] = useState(initialRoom.hostId);
  const [settings, setSettings] = useState<LobbySettings>(initialRoom.settings);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const [claimHostError, setClaimHostError] = useState<string | null>(null);
  const [deckSize, setDeckSize] = useState<number | null>(null);

  /** Keep a ref to the current players list so interval callbacks can read it. */
  const playersRef = useRef<LobbyPresence[]>(players);
  playersRef.current = players;

  /** Keep a ref to the current hostId so interval callbacks can read it. */
  const hostIdRef = useRef<string>(hostId);
  hostIdRef.current = hostId;

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (currentPlayer === undefined) {
    throw new Error("Current player was missing from the initial lobby payload.");
  }

  const isHost = hostId === currentPlayer.userId;

  /** Whether the current host is present in the connected-player list. */
  const isHostOnline = players.some((p) => p.userId === hostId);

  // Debounced deck size estimation — refreshes when difficulty or house rules change.
  useEffect(() => {
    const houseRules: HouseRuleParams = {
      genreLockId: settings.genreLockId,
      consoleLockFamily: settings.consoleLockFamily,
      decadeStart: settings.decadeStart,
    };
    const timer = setTimeout(() => {
      void getDeckSize(settings.difficulty, houseRules).then(setDeckSize);
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [settings.difficulty, settings.genreLockId, settings.consoleLockFamily, settings.decadeStart]);

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
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          return;
        }

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

  /**
   * Disconnect-handling effect: starts a 30-second countdown when the host
   * leaves Presence (and we are not the host), cancels it when the host
   * reconnects, and triggers claimHost when the countdown expires.
   */
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

    // Host is offline and we are not the host — start countdown if not running.
    if (countdownIntervalRef.current !== null) {
      return;
    }

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
      // CONFLICT means another client already claimed host — silently ignore.
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

  async function handleCopyRoomCode(): Promise<void> {
    const clipboard = "clipboard" in navigator ? navigator.clipboard : undefined;
    if (clipboard === undefined) {
      toast.error("Clipboard unavailable", {
        description: "Copying only works in a secure browser context.",
      });
      return;
    }

    try {
      await clipboard.writeText(initialRoom.roomCode);
      toast.success("Room code copied", {
        description: `${initialRoom.roomCode} is ready to share.`,
      });
    } catch (error: unknown) {
      toast.error("Could not copy room code", {
        description:
          error instanceof Error ? error.message : "The browser blocked clipboard access.",
      });
    }
  }

  async function handleLeaveRoom(): Promise<void> {
    setIsLeaving(true);
    setLeaveError(null);

    if (isHost && players.length > 1) {
      const nextHost = [...players]
        .filter((p) => p.userId !== initialRoom.currentUserId)
        .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];
      if (nextHost !== undefined) {
        void channelRef.current?.send({
          type: "broadcast",
          event: "host_transferred",
          payload: { newHostId: nextHost.userId },
        });
      }
    }

    const result = await leaveRoom(initialRoom.roomId);
    if (!result.success) {
      setIsLeaving(false);
      setLeaveError(result.error.message);
      return;
    }

    router.push("/play");
  }

  async function handleKickPlayer(targetUserId: string): Promise<void> {
    setKickingUserId(targetUserId);
    setKickError(null);

    const result = await kickPlayer(initialRoom.roomId, targetUserId);
    if (!result.success) {
      setKickingUserId(null);
      setKickError(result.error.message);
      return;
    }

    void channelRef.current?.send({
      type: "broadcast",
      event: "player_kicked",
      payload: { userId: targetUserId },
    });
    setKickingUserId(null);
  }

  async function handleUpdateSettings(patch: Partial<LobbySettings>): Promise<void> {
    setIsSavingSettings(true);
    setSettingsError(null);

    const newSettings = { ...settings, ...patch };
    const result = await updateSettings(initialRoom.roomId, newSettings);
    if (!result.success) {
      setIsSavingSettings(false);
      setSettingsError(result.error.message);
      return;
    }

    void channelRef.current?.send({
      type: "broadcast",
      event: "settings_updated",
      payload: newSettings,
    });
    setSettings(newSettings);
    setIsSavingSettings(false);
  }

  async function handleStartGame(): Promise<void> {
    setIsStarting(true);
    setStartError(null);

    try {
      const result = await startGame(initialRoom.roomId);
      if (!result.success) {
        setStartError(result.error.message);
        return;
      }

      void channelRef.current?.send({
        type: "broadcast",
        event: "game_started",
        payload: {
          sessionId: result.data.gameSessionId,
          turnOrder: result.data.turnOrder,
          startingCards: result.data.startingCards,
          firstCard: result.data.firstCard,
        },
      });
      router.push(`/play/game/${result.data.gameSessionId}`);
    } catch (err: unknown) {
      setStartError(
        err instanceof Error ? err.message : "Failed to start the game. Please try again.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="w-full max-w-4xl space-y-6">
        <Card className="border-border/60 bg-surface-800/70">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Users className="text-primary-400 h-5 w-5" />
                Multiplayer Lobby
              </CardTitle>
              <CardDescription>
                Share the room code, wait for everyone to connect, then start the game.
              </CardDescription>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="text-text-secondary text-xs font-medium tracking-[0.3em] uppercase">
                Room code
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-text-primary rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-lg tracking-[0.35em] sm:text-xl">
                  {initialRoom.roomCode}
                </span>
                <Button variant="outline" onClick={() => void handleCopyRoomCode()}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {disconnectCountdown !== null && (
          <div
            className="bg-warning/10 border-warning/30 text-warning rounded-lg border px-4 py-3 text-sm"
            role="alert"
          >
            Host disconnected — transferring in {disconnectCountdown}s…
          </div>
        )}

        {claimHostError !== null && (
          <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
            {claimHostError}
          </p>
        )}

        <LobbyPlayerList
          players={players}
          currentUserId={initialRoom.currentUserId}
          hostId={hostId}
          maxPlayers={initialRoom.maxPlayers}
          isHost={isHost}
          kickingUserId={kickingUserId}
          onKickPlayer={(userId) => void handleKickPlayer(userId)}
        />

        {kickError !== null && (
          <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
            {kickError}
          </p>
        )}

        <LobbySettingsPanel
          settings={settings}
          genres={initialRoom.genres}
          isHost={isHost}
          isSaving={isSavingSettings}
          onSettingChange={(patch) => void handleUpdateSettings(patch)}
        />

        {settingsError !== null && (
          <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
            {settingsError}
          </p>
        )}

        <LobbyHostControls
          isHost={isHost}
          isStarting={isStarting}
          canStart={players.length >= 2}
          onStartGame={() => void handleStartGame()}
          startError={startError}
          deckSize={deckSize}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-text-secondary text-sm">
            Waiting in lobby as{" "}
            <span className="text-text-primary font-medium">{currentPlayer.displayName}</span>.
          </p>
          <Button
            variant="outline"
            disabled={isLeaving}
            onClick={() => {
              void handleLeaveRoom();
            }}
          >
            {isLeaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Leaving room...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Leave Room
              </>
            )}
          </Button>
        </div>

        {leaveError !== null && (
          <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
            {leaveError}
          </p>
        )}
      </div>
    </div>
  );
}
