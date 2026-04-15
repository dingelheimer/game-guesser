// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Crown, Loader2, X } from "lucide-react";
import type { LobbyPresence } from "@/lib/multiplayer/lobby";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Props for the {@link LobbyPlayerList} component.
 */
export type LobbyPlayerListProps = Readonly<{
  players: readonly LobbyPresence[];
  currentUserId: string;
  hostId: string;
  maxPlayers: number;
  isHost: boolean;
  kickingUserId: string | null;
  onKickPlayer: (userId: string) => void;
}>;

/**
 * Displays the connected players card in the multiplayer lobby, including host badges
 * and kick controls visible only to the current host.
 */
export function LobbyPlayerList({
  players,
  currentUserId,
  hostId,
  maxPlayers,
  isHost,
  kickingUserId,
  onKickPlayer,
}: LobbyPlayerListProps) {
  return (
    <Card className="border-border/60 bg-surface-800/70">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Players</CardTitle>
            <CardDescription>
              Connected lobby members update in real time as people join and leave.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-text-primary self-start">
            {`${String(players.length)}/${String(maxPlayers)}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {players.map((player) => (
            <div
              key={player.userId}
              className="border-border/60 bg-background/40 flex items-center justify-between rounded-xl border px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-text-primary truncate text-sm font-medium">
                    {player.displayName}
                  </span>
                  {player.userId === currentUserId && <Badge variant="secondary">You</Badge>}
                  {player.userId === hostId && (
                    <Badge variant="outline" className="gap-1">
                      <Crown className="h-3 w-3" />
                      Host
                    </Badge>
                  )}
                </div>
                <p className="text-text-secondary text-xs">
                  Joined {new Date(player.joinedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-300">Connected</span>
                </div>
                {isHost && player.userId !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={kickingUserId === player.userId}
                    onClick={() => {
                      onKickPlayer(player.userId);
                    }}
                    aria-label={`Kick ${player.displayName}`}
                  >
                    {kickingUserId === player.userId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
