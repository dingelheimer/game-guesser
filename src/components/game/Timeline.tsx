// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { GameCard } from "./GameCard";
import type { TimelineItem } from "./timelineTypes";
import { ZONE_DATA_ATTR, parseZoneIndex } from "./timelineTypes";
import { YearMarker, DropZone, DraggablePendingCard } from "./TimelineDropZone";

export type { TimelineItem } from "./timelineTypes";

export interface TimelineProps {
  /** Cards already placed on the timeline, sorted by releaseYear ASC. */
  placedCards: TimelineItem[];
  /**
   * The card currently being placed.
   * When null/undefined, drop zones are hidden and the timeline is read-only.
   */
  pendingCard?: TimelineItem | null;
  /**
   * Called when the player selects a placement position.
   * `position` is 0-based: 0 = before first card, placedCards.length = after last card.
   */
  onPlaceCard?: (position: number) => void;
  /** Optional highlighted card ID for transient placement feedback. */
  highlightedCardId?: string | null;
  /** Visual style for the highlighted card feedback. */
  highlightedCardTone?: "error" | null;
  className?: string;
}

/** Drag-and-drop timeline for placing game cards in chronological order. */
export function Timeline({
  placedCards,
  pendingCard,
  onPlaceCard,
  highlightedCardId = null,
  highlightedCardTone = null,
  className,
}: TimelineProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [activeCard, setActiveCard] = useState<TimelineItem | null>(null);
  const [activeDropZoneId, setActiveDropZoneId] = useState<string | null>(null);
  /**
   * Roving tabindex: tracks which drop zone has tabIndex=0.
   * Keyboard users Tab into zone 0, then use arrow keys to navigate.
   */
  const [focusedZone, setFocusedZone] = useState(0);

  const hasPending = pendingCard != null;
  const zoneCount = placedCards.length + 1;
  const isOverlayOverValidDropZone = activeDropZoneId !== null;
  const cardLayoutTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.25, 1, 0.5, 1] as const };
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0",
        },
      },
    }),
    duration: reduceMotion ? 0 : 300,
    easing: "cubic-bezier(0.25, 1, 0.5, 1)",
  };

  // Reset the keyboard cursor to zone 0 whenever a new card is placed.
  useEffect(() => {
    setFocusedZone(0);
  }, [placedCards.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handlePlace = useCallback(
    (position: number) => {
      onPlaceCard?.(position);
    },
    [onPlaceCard],
  );

  /** Move keyboard focus to an adjacent drop zone. */
  const handleNavigate = useCallback(
    (fromIndex: number, direction: "prev" | "next") => {
      const next =
        direction === "next" ? Math.min(fromIndex + 1, zoneCount - 1) : Math.max(fromIndex - 1, 0);

      if (next === fromIndex) return;

      setFocusedZone(next);
      // Programmatically focus via data attribute lookup (avoids ref arrays).
      const el = document.querySelector<HTMLButtonElement>(`[${ZONE_DATA_ATTR}="${String(next)}"]`);
      el?.focus();
    },
    [zoneCount],
  );

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (typeof overId !== "string" || parseZoneIndex(overId) === null) {
      setActiveDropZoneId(null);
      return;
    }

    setActiveDropZoneId(overId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDropZoneId(null);
    const overId = event.over?.id;
    if (typeof overId === "string") {
      const idx = parseZoneIndex(overId);
      if (idx !== null) handlePlace(idx);
    }
    setActiveCard(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => {
        setActiveCard(pendingCard ?? null);
        setActiveDropZoneId(null);
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveCard(null);
        setActiveDropZoneId(null);
      }}
    >
      <div className={cn("flex flex-col gap-6", className)}>
        {/* Desktop drag source only; mobile uses tap-to-place drop zones. */}
        {hasPending && (
          <div className="hidden justify-center md:flex">
            <DraggablePendingCard card={pendingCard} />
          </div>
        )}

        <div
          className={cn(
            // Mobile: vertical stack, full width
            "flex flex-col items-stretch gap-2",
            // Desktop: horizontal row with horizontal scroll; edge spacers prevent clipping
            "md:flex-row md:items-end md:justify-center md:gap-3 md:overflow-x-auto md:pb-4",
            // Always maintain a minimum height so the section doesn't collapse
            "min-h-[80px] md:min-h-[300px] xl:min-h-[326px]",
            placedCards.length === 0 && "justify-center",
          )}
          role="group"
          aria-label="Your timeline"
        >
          {/* Edge spacer — keeps content away from scroll container edges on desktop */}
          <div className="hidden shrink-0 md:block md:w-4" aria-hidden="true" />

          {/* Zone 0 — before all cards */}
          {hasPending && (
            <DropZone
              index={0}
              isFocused={focusedZone === 0}
              onSelect={() => {
                handlePlace(0);
              }}
              onNavigate={(dir) => {
                handleNavigate(0, dir);
              }}
              onFocus={() => {
                setFocusedZone(0);
              }}
              positionLabel={placedCards[0] ? `before ${placedCards[0].title}` : "first position"}
              reduceMotion={reduceMotion}
              isFirst={placedCards.length === 0}
            />
          )}

          {placedCards.map((card, i) => (
            <Fragment key={card.id}>
              {/* Placed card with year marker */}
              <motion.div
                layout
                animate={
                  highlightedCardId === card.id && highlightedCardTone === "error" && !reduceMotion
                    ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
                    : { x: 0 }
                }
                transition={{
                  x: {
                    duration:
                      highlightedCardId === card.id &&
                      highlightedCardTone === "error" &&
                      !reduceMotion
                        ? 0.4
                        : 0,
                  },
                  layout: cardLayoutTransition,
                }}
                className="flex shrink-0 flex-col items-center gap-1"
                aria-label={`${card.title}, ${String(card.releaseYear)}`}
              >
                <div
                  className={cn(
                    highlightedCardId === card.id &&
                      highlightedCardTone === "error" &&
                      "rounded-2xl shadow-[0_0_20px_rgba(244,63,94,0.35)] ring-2 ring-rose-500",
                  )}
                >
                  <GameCard
                    screenshotImageId={card.screenshotImageId}
                    coverImageId={card.coverImageId}
                    title={card.title}
                    releaseYear={card.releaseYear}
                    platform={card.platform}
                    isRevealed={card.isRevealed}
                    size="timeline"
                    className="w-[40vw] md:w-[180px] lg:w-[200px] xl:w-[220px]"
                  />
                </div>
                {card.isRevealed ? <YearMarker year={card.releaseYear} /> : null}
              </motion.div>

              {/* Zone after this card (zone i+1) */}
              {hasPending && (
                <DropZone
                  index={i + 1}
                  isFocused={focusedZone === i + 1}
                  onSelect={() => {
                    handlePlace(i + 1);
                  }}
                  onNavigate={(dir) => {
                    handleNavigate(i + 1, dir);
                  }}
                  onFocus={() => {
                    setFocusedZone(i + 1);
                  }}
                  positionLabel={(() => {
                    const nextCard = placedCards[i + 1];
                    return nextCard
                      ? `between ${card.title} and ${nextCard.title}`
                      : `after ${card.title}`;
                  })()}
                  reduceMotion={reduceMotion}
                />
              )}
            </Fragment>
          ))}

          {/* Empty state */}
          {placedCards.length === 0 && !hasPending && (
            <p className="text-text-secondary self-center text-sm">No cards placed yet</p>
          )}

          {/* Edge spacer — mirrors the leading spacer to balance scroll padding */}
          <div className="hidden shrink-0 md:block md:w-4" aria-hidden="true" />
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeCard ? (
          <div
            className={cn(
              "pointer-events-none scale-95 rotate-2 opacity-80 transition-shadow duration-150",
              isOverlayOverValidDropZone &&
                "ring-primary-400 shadow-[0_0_24px_rgba(139,92,246,0.45)] ring-2",
            )}
            aria-hidden="true"
          >
            <GameCard
              screenshotImageId={activeCard.screenshotImageId}
              coverImageId={activeCard.coverImageId}
              title={activeCard.title}
              releaseYear={activeCard.releaseYear}
              platform={activeCard.platform}
              isRevealed={activeCard.isRevealed}
              size="timeline"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
