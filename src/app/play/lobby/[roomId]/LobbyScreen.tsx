// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, LogOut, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { kickPlayer, leaveRoom } from "@/lib/multiplayer/actions";
import { getDeckSize, startGame, updateSettings } from "@/lib/multiplayer/hostActions";
import type { LobbySettings, HouseRuleParams } from "@/lib/multiplayer/lobby";
import type { LobbyRoomPageData } from "@/lib/multiplayer/lobbyPage";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LobbyHostControls } from "./LobbyHostControls";
import { LobbyPlayerList } from "./LobbyPlayerList";
import { LobbySettingsPanel } from "./LobbySettingsPanel";
import { useLobbyRealtime } from "./useLobbyRealtime";
import { AdSlot } from "@/components/ads/ad-slot";

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
  const currentPlayer = useMemo(
    () => initialRoom.players.find((player) => player.userId === initialRoom.currentUserId),
    [initialRoom.currentUserId, initialRoom.players],
  );

  if (currentPlayer === undefined) {
    throw new Error("Current player was missing from the initial lobby payload.");
  }

  const {
    players,
    hostId,
    settings,
    isHost,
    disconnectCountdown,
    claimHostError,
    broadcast,
    setSettings,
  } = useLobbyRealtime(initialRoom, currentPlayer);

  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [deckSize, setDeckSize] = useState<number | null>(null);

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
        broadcast("host_transferred", { newHostId: nextHost.userId });
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

    broadcast("player_kicked", { userId: targetUserId });
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

    broadcast("settings_updated", newSettings);
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

      broadcast("game_started", {
        sessionId: result.data.gameSessionId,
        turnOrder: result.data.turnOrder,
        startingCards: result.data.startingCards,
        firstCard: result.data.firstCard,
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

        <AdSlot placement="lobby" size={[728, 90]} />
      </div>
    </div>
  );
}
