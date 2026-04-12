"use client";

import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the {@link LobbyHostControls} component.
 */
export type LobbyHostControlsProps = Readonly<{
  isHost: boolean;
  isStarting: boolean;
  canStart: boolean;
  onStartGame: () => void;
  startError: string | null;
}>;

/**
 * Renders the "Start Game" button for the host or a waiting message for non-host players.
 */
export function LobbyHostControls({
  isHost,
  isStarting,
  canStart,
  onStartGame,
  startError,
}: LobbyHostControlsProps) {
  if (!isHost) {
    return <p className="text-text-secondary text-sm">Waiting for host to start...</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button disabled={!canStart || isStarting} onClick={onStartGame}>
        {isStarting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting game...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Start Game
          </>
        )}
      </Button>
      {startError !== null && (
        <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
          {startError}
        </p>
      )}
    </div>
  );
}
