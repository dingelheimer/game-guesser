// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
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
  type Announcements,
  type DropAnimation,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion";
import { GameCard } from "./GameCard";
import type { TimelineItem } from "./timelineTypes";
import { ZONE_DATA_ATTR, parseZoneIndex } from "./timelineTypes";
import { YearMarker, DropZone, DraggablePendingCard } from "./TimelineDropZone";

export type { TimelineItem } from "./timelineTypes";

/**
 * Returns a human-readable drop zone position label for screen reader announcements.
 * Zone index `i` corresponds to the slot before `placedCards[i]`.
 */
function describeZonePosition(placedCards: TimelineItem[], index: number): string {
  const prev = placedCards[index - 1];
  const next = placedCards[index];
  if (prev !== undefined && next !== undefined)
    return `between ${prev.title} (${String(prev.releaseYear)}) and ${next.title} (${String(next.releaseYear)})`;
  if (prev !== undefined) return `after ${prev.title} (${String(prev.releaseYear)})`;
  if (next !== undefined) return `before ${next.title} (${String(next.releaseYear)})`;
  return "at the first position";
}

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
  /** True from the moment the card is dropped until the next drag starts. */
  const [isDropping, setIsDropping] = useState(false);
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
    : { duration: MOTION.duration.normal, ease: MOTION.ease.snappy };
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0",
        },
      },
    }),
    duration: reduceMotion ? 0 : MOTION.duration.normal * 1000,
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

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart() {
        return pendingCard
          ? `Picked up ${pendingCard.title}. Use arrow keys to move between drop zones.`
          : "Picked up game card. Use arrow keys to move between drop zones.";
      },
      onDragOver({ over }) {
        if (!over) return "Not over a drop zone.";
        const idx = parseZoneIndex(String(over.id));
        if (idx === null) return "Not over a drop zone.";
        return `Hovering over position: ${describeZonePosition(placedCards, idx)}.`;
      },
      onDragEnd({ over }) {
        if (!over) return "Card placement cancelled.";
        const idx = parseZoneIndex(String(over.id));
        if (idx === null) return "Card placement cancelled.";
        return `Placed ${pendingCard?.title ?? "game card"} ${describeZonePosition(placedCards, idx)}.`;
      },
      onDragCancel() {
        return "Drag cancelled. Card returned to original position.";
      },
    }),
    [pendingCard, placedCards],
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
    // Mark as dropping so the overlay sheds its drag transforms before dnd-kit
    // runs the drop animation, preventing a visual size/rotation snap.
    setIsDropping(true);
    setActiveDropZoneId(null);
    const overId = event.over?.id;
    if (typeof overId === "string") {
      const idx = parseZoneIndex(overId);
      if (idx !== null) handlePlace(idx);
    }
    // Do NOT null activeCard here — keep overlay content alive for the drop
    // animation. dnd-kit unmounts the overlay once the animation finishes.
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      modifiers={[snapCenterToCursor]}
      onDragStart={() => {
        setActiveCard(pendingCard ?? null);
        setActiveDropZoneId(null);
        setIsDropping(false);
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveCard(null);
        setActiveDropZoneId(null);
        setIsDropping(false);
      }}
    >
      <div className={cn("flex flex-col gap-6", className)}>
        {/* Desktop drag source only; mobile uses tap-to-place drop zones. */}
        {hasPending && (
          <div className="hidden justify-center md:flex">
            <DraggablePendingCard card={pendingCard} />
          </div>
        )}

        {/*
         * Outer: scroll container only — no justify-content centering here.
         * Inner: shrinks to content width on desktop so mx-auto can centre it.
         * With few cards: inner is narrower than outer → mx-auto centres it.
         * With many cards (overflow): inner is wider → overflow-x-auto scrolls
         * edge-to-edge without clipping the left side.
         */}
        <div
          className={cn(
            // Mobile: vertical stack container
            "flex flex-col",
            // Desktop: horizontal scroll container (centering delegated to inner wrapper)
            "md:overflow-x-auto md:pb-4",
            // Always maintain a minimum height so the section doesn't collapse
            "min-h-[80px] md:min-h-[300px] xl:min-h-[326px]",
            placedCards.length === 0 && "justify-center",
          )}
          role="group"
          aria-label="Your timeline"
        >
          {/* Inner centering wrapper — w-fit lets mx-auto centre on desktop */}
          <div
            className={cn(
              "flex flex-col items-stretch gap-2",
              "mx-auto md:w-fit md:flex-row md:items-end md:gap-3",
            )}
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
                    highlightedCardId === card.id &&
                    highlightedCardTone === "error" &&
                    !reduceMotion
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
                      className="aspect-[3/4] w-[40vw] md:w-[180px] lg:w-[200px] xl:w-[220px]"
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
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeCard ? (
          <div
            className={cn(
              // Bug 1 fix: w-fit + rounded-xl ensure the ring hugs the card
              "pointer-events-none w-fit rounded-xl transition-shadow duration-150",
              // Bug 2 fix: remove transforms on drop so the ghost matches the
              // placed card before dnd-kit swaps overlay → timeline card
              !isDropping && "scale-95 rotate-2 opacity-80",
              isOverlayOverValidDropZone &&
                !isDropping &&
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
              className="aspect-[3/4]"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
