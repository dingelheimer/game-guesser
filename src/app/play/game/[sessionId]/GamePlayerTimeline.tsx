// SPDX-License-Identifier: AGPL-3.0-only
import { Timeline, type TimelineItem } from "@/components/game/Timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MultiplayerGamePagePlayer, MultiplayerTurnCard } from "@/lib/multiplayer/gamePage";
import { cn } from "@/lib/utils";

/**
 * Props for a single player's multiplayer timeline panel.
 */
export type GamePlayerTimelineProps = Readonly<{
  activityBadgeLabel?: string | null;
  connectionLabel?: string;
  highlightedCardId?: string | null;
  highlightedCardTone?: "error" | null;
  isActive: boolean;
  isConnected: boolean;
  isCurrentUser: boolean;
  onPlaceCard?: (position: number) => void;
  pendingTurnCard?: MultiplayerTurnCard | null;
  player: MultiplayerGamePagePlayer;
  winCondition: number;
}>;

function toTimelineItem(card: MultiplayerGamePagePlayer["timeline"][number]): TimelineItem {
  return {
    id: String(card.gameId),
    screenshotImageId: card.screenshotImageId,
    coverImageId: card.coverImageId,
    title: card.title,
    releaseYear: card.releaseYear,
    platform: card.platform,
    isRevealed: card.isRevealed,
  };
}

function toPendingTimelineItem(card: MultiplayerTurnCard): TimelineItem {
  return {
    id: "pending-turn-card",
    screenshotImageId: card.screenshotImageId,
    coverImageId: card.coverImageId,
    title: card.title,
    releaseYear: card.releaseYear ?? 0,
    platform: card.platform,
    isRevealed: card.isRevealed,
  };
}

/**
 * Render one player's score, token count, and revealed timeline cards.
 */
export function GamePlayerTimeline({
  activityBadgeLabel = null,
  connectionLabel,
  highlightedCardId = null,
  highlightedCardTone = null,
  isActive,
  isConnected,
  isCurrentUser,
  onPlaceCard,
  pendingTurnCard = null,
  player,
  winCondition,
}: GamePlayerTimelineProps) {
  const timelineItems = player.timeline.map(toTimelineItem);

  return (
    <Card
      className={cn(
        "border-border/60 bg-surface-800/70 overflow-visible transition-shadow",
        isActive && "border-primary-400/70 shadow-[0_0_24px_rgba(139,92,246,0.22)]",
        !isConnected && "opacity-80",
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span>{player.displayName}</span>
              {isCurrentUser ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium">
                  You
                </span>
              ) : null}
              {activityBadgeLabel !== null ? (
                <span className="bg-primary-500/15 rounded-full px-2 py-0.5 text-xs font-medium text-violet-200">
                  {activityBadgeLabel}
                </span>
              ) : isActive ? (
                <span className="bg-primary-500/15 rounded-full px-2 py-0.5 text-xs font-medium text-violet-200">
                  Active turn
                </span>
              ) : null}
            </CardTitle>
            <p className="text-text-secondary text-sm">
              {connectionLabel ?? (isConnected ? "Connected" : "Waiting on realtime presence")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
              Score {player.score}/{winCondition}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
              Tokens {player.tokens}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Timeline
          placedCards={timelineItems}
          pendingCard={pendingTurnCard === null ? null : toPendingTimelineItem(pendingTurnCard)}
          highlightedCardId={highlightedCardId}
          highlightedCardTone={highlightedCardTone}
          {...(onPlaceCard !== undefined ? { onPlaceCard } : {})}
        />
      </CardContent>
    </Card>
  );
}
