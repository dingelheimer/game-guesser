"use client";

import { AlertTriangle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_POOL_SIZE = 30;

/**
 * Props for the {@link LobbyHostControls} component.
 */
export type LobbyHostControlsProps = Readonly<{
  isHost: boolean;
  isStarting: boolean;
  canStart: boolean;
  onStartGame: () => void;
  startError: string | null;
  /** Estimated number of games available for the current difficulty + house rules. Null while loading. */
  deckSize?: number | null;
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
  deckSize,
}: LobbyHostControlsProps) {
  if (!isHost) {
    return <p className="text-text-secondary text-sm">Waiting for host to start...</p>;
  }

  const poolTooSmall = deckSize !== null && deckSize !== undefined && deckSize < MIN_POOL_SIZE;
  const isDisabled = !canStart || isStarting || poolTooSmall;

  return (
    <div className="flex flex-col gap-2">
      {poolTooSmall && (
        <p className="text-destructive flex items-center gap-1.5 text-sm" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Only {deckSize} game{deckSize === 1 ? "" : "s"} match the current filters — need at least{" "}
          {MIN_POOL_SIZE}. Adjust the house rules or difficulty.
        </p>
      )}
      {deckSize !== null && deckSize !== undefined && !poolTooSmall && (
        <p className="text-text-secondary text-xs">
          {deckSize} game{deckSize === 1 ? "" : "s"} available
        </p>
      )}
      <Button disabled={isDisabled} onClick={onStartGame}>
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
