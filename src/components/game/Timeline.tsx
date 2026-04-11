"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { GameCard } from "./GameCard";

// ── Public types ──────────────────────────────────────────────────────────────

export interface TimelineItem {
  id: string;
  screenshotImageId: string | null;
  coverImageId: string | null;
  title: string;
  releaseYear: number;
  platform: string;
  /** True once the card has been placed and revealed on the timeline. */
  isRevealed: boolean;
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
  className?: string;
}

// ── Internal constants ────────────────────────────────────────────────────────

const PENDING_DRAGGABLE_ID = "pending-card";
const ZONE_DATA_ATTR = "data-zone-index";

function zoneDroppableId(index: number): string {
  return `zone-${String(index)}`;
}

function parseZoneIndex(id: string): number | null {
  if (!id.startsWith("zone-")) return null;
  const n = parseInt(id.slice(5), 10);
  return isNaN(n) ? null : n;
}

// ── YearMarker ────────────────────────────────────────────────────────────────

function YearMarker({ year }: { year: number }) {
  return (
    <div className="flex flex-col items-center md:flex-row" aria-hidden="true">
      <div className="bg-surface-600 h-3 w-0.5 md:h-0.5 md:w-3" />
      <span className="bg-surface-800 text-text-secondary rounded px-1.5 py-0.5 font-mono text-xs tabular-nums">
        {year}
      </span>
      <div className="bg-surface-600 h-3 w-0.5 md:h-0.5 md:w-3" />
    </div>
  );
}

// ── DropZone ──────────────────────────────────────────────────────────────────

interface DropZoneProps {
  index: number;
  isFocused: boolean;
  onSelect: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onFocus: () => void;
  positionLabel: string;
  reduceMotion: boolean;
  /** True on the very first turn when the timeline is empty (single zone). */
  isFirst?: boolean;
}

function DropZone({
  index,
  isFocused,
  onSelect,
  onNavigate,
  onFocus,
  positionLabel,
  reduceMotion,
  isFirst = false,
}: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneDroppableId(index) });
  const isActive = isOver || isFocused;

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 500, damping: 30 };

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        onNavigate("next");
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        onNavigate("prev");
        break;
    }
  }

  return (
    <button
      ref={setNodeRef}
      tabIndex={isFocused ? 0 : -1}
      {...{ [ZONE_DATA_ATTR]: index }}
      className={cn(
        "group relative flex shrink-0 items-center justify-center",
        "rounded-lg border-2 border-dashed transition-colors duration-200",
        "focus-visible:ring-primary-400 focus-visible:ring-2 focus-visible:outline-none",
        // Minimum accessible touch target
        "min-h-[44px] min-w-[44px]",
        // Mobile: full width, variable height
        "w-full",
        // Desktop: auto width (grows with animation), height matches timeline cards (aspect-[3/4] at md:180px → 240px, lg:200px → 267px)
        "md:h-[240px] md:w-auto lg:h-[267px]",
        isActive
          ? "border-primary-400 bg-primary-500/20"
          : isFirst
            ? "border-primary-500/60 bg-primary-500/10 hover:border-primary-400/70"
            : "border-white/35 bg-transparent hover:border-primary-400/50",
      )}
      style={{ touchAction: "none" }}
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      aria-label={`Place card ${positionLabel}. Press Enter to confirm.`}
    >
      {/* Mobile: horizontal bar (grows taller when active) */}
      <motion.div
        className="bg-primary-500/40 block w-full rounded md:hidden"
        animate={{ height: isActive ? 40 : isFirst ? 10 : 6 }}
        transition={spring}
      />

      {/* Desktop: vertical bar (grows wider when active) */}
      <motion.div
        className="bg-primary-500/40 hidden h-full items-center justify-center overflow-hidden rounded md:flex"
        animate={
          isActive
            ? { width: 52, opacity: 1 }
            : reduceMotion
              ? { width: isFirst ? 20 : 16, opacity: isFirst ? 0.7 : 0.5 }
              : { width: isFirst ? 20 : 16, opacity: isFirst ? [0.5, 0.9, 0.5] : [0.3, 0.6, 0.3] }
        }
        transition={
          isActive
            ? spring
            : { width: spring, opacity: { repeat: Infinity, duration: 2, ease: "easeInOut" } }
        }
      >
        {isActive && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-primary-400 select-none text-xl font-bold leading-none"
          >
            +
          </motion.span>
        )}
      </motion.div>

      {/* First-turn "place here" overlay — visible in idle state only */}
      {isFirst && !isActive && (
        <div className="pointer-events-none absolute inset-0 hidden flex-col items-center justify-center gap-1.5 md:flex">
          <span className="text-primary-400 text-2xl leading-none" aria-hidden="true">
            ↓
          </span>
          <span className="text-primary-300 text-xs font-medium">Place here</span>
        </div>
      )}
    </button>
  );
}

// ── DraggablePendingCard ──────────────────────────────────────────────────────

function DraggablePendingCard({ card }: { card: TimelineItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: PENDING_DRAGGABLE_ID,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab touch-none select-none active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <GameCard
        screenshotImageId={card.screenshotImageId}
        coverImageId={card.coverImageId}
        title={card.title}
        releaseYear={card.releaseYear}
        platform={card.platform}
        isRevealed={card.isRevealed}
      />
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function Timeline({ placedCards, pendingCard, onPlaceCard, className }: TimelineProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [isDragging, setIsDragging] = useState(false);
  /**
   * Roving tabindex: tracks which drop zone has tabIndex=0.
   * Keyboard users Tab into zone 0, then use arrow keys to navigate.
   */
  const [focusedZone, setFocusedZone] = useState(0);

  const hasPending = pendingCard != null;
  const zoneCount = placedCards.length + 1;

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

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    const overId = event.over?.id;
    if (typeof overId === "string") {
      const idx = parseZoneIndex(overId);
      if (idx !== null) handlePlace(idx);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => {
        setIsDragging(true);
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setIsDragging(false);
      }}
    >
      <div className={cn("flex flex-col gap-6", className)}>
        {/* ── Pending card (drag source) — desktop only ──────────────── */}
        {/* On mobile, players use tap-to-place via drop zone buttons.     */}
        {/* Hiding the hero-sized card on mobile avoids doubling the card  */}
        {/* height (it already appears in the card area) and prevents the  */}
        {/* heavy vertical scroll needed to reach the drop zones.          */}
        {hasPending && (
          <div className="hidden justify-center md:flex">
            <DraggablePendingCard card={pendingCard} />
          </div>
        )}

        {/* ── Timeline rail ──────────────────────────────────────────── */}
        <div
          className={cn(
            // Mobile: vertical stack, full width
            "flex flex-col items-stretch gap-2",
            // Desktop: horizontal row with horizontal scroll; px-4 prevents content from clipping at edges
            "md:flex-row md:items-end md:gap-3 md:overflow-x-auto md:px-4 md:pb-4",
            // Always maintain a minimum height so the section doesn't collapse
            "min-h-[80px] md:min-h-[300px]",
            placedCards.length === 0 && "justify-center",
          )}
          role="group"
          aria-label="Your timeline"
        >
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
              <div
                className="flex shrink-0 flex-col items-center gap-1"
                aria-label={`${card.title}, ${String(card.releaseYear)}`}
              >
                <GameCard
                  screenshotImageId={card.screenshotImageId}
                  coverImageId={card.coverImageId}
                  title={card.title}
                  releaseYear={card.releaseYear}
                  platform={card.platform}
                  isRevealed={card.isRevealed}
                  size="timeline"
                  className="w-[40vw] md:w-[180px] lg:w-[200px]"
                />
                <YearMarker year={card.releaseYear} />
              </div>

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
        </div>
      </div>

      {/* ── Drag overlay — ghost card while dragging ───────────────────── */}
      <DragOverlay>
        {isDragging && pendingCard ? (
          <div className="pointer-events-none scale-95 rotate-2 opacity-80" aria-hidden="true">
            <GameCard
              screenshotImageId={pendingCard.screenshotImageId}
              coverImageId={pendingCard.coverImageId}
              title={pendingCard.title}
              releaseYear={pendingCard.releaseYear}
              platform={pendingCard.platform}
              isRevealed={pendingCard.isRevealed}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
