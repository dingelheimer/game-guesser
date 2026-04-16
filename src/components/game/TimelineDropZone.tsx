// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { motion } from "framer-motion";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion";
import { GameCard } from "./GameCard";
import type { TimelineItem } from "./timelineTypes";
import { PENDING_DRAGGABLE_ID, ZONE_DATA_ATTR, zoneDroppableId } from "./timelineTypes";

/** Displays the release year between timeline cards. */
export function YearMarker({ year }: { year: number }) {
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

export interface DropZoneProps {
  index: number;
  isFocused: boolean;
  /** When true, gives this zone tabIndex=0 without triggering the visual highlight. */
  isTabTarget?: boolean;
  onSelect: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onFocus: () => void;
  positionLabel: string;
  reduceMotion: boolean;
  /** True on the very first turn when the timeline is empty (single zone). */
  isFirst?: boolean;
}

/** Interactive drop target for card placement on the timeline. */
export function DropZone({
  index,
  isFocused,
  isTabTarget = false,
  onSelect,
  onNavigate,
  onFocus,
  positionLabel,
  reduceMotion,
  isFirst = false,
}: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneDroppableId(index) });
  const isActive = isOver || isFocused;

  const spring = reduceMotion ? { duration: 0 } : { type: "spring" as const, ...MOTION.spring };

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
      tabIndex={isFocused || isTabTarget ? 0 : -1}
      {...{ [ZONE_DATA_ATTR]: index }}
      className={cn(
        "group relative flex shrink-0 items-center justify-center",
        "rounded-lg border-2 border-dashed transition-colors duration-200",
        "focus-visible:ring-primary-400 focus-visible:ring-2 focus-visible:outline-none",
        // Minimum accessible touch target
        "min-h-[44px] min-w-[44px]",
        // Mobile: full width, variable height
        "w-full",
        // Desktop: auto width (grows with animation), height matches timeline cards.
        "md:h-[240px] md:w-auto lg:h-[267px] xl:h-[293px]",
        isActive
          ? "border-primary-400 bg-primary-500/20"
          : isFirst
            ? "border-primary-500/60 bg-primary-500/10 hover:border-primary-400/70"
            : "hover:border-primary-400/50 border-white/35 bg-transparent",
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
            ? { width: 80, opacity: 1 }
            : reduceMotion
              ? { width: isFirst ? 36 : 28, opacity: isFirst ? 0.7 : 0.5 }
              : { width: isFirst ? 36 : 28, opacity: isFirst ? [0.5, 0.9, 0.5] : [0.3, 0.6, 0.3] }
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
            className="text-primary-400 text-xl leading-none font-bold select-none"
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

/** Draggable wrapper for the pending card (desktop drag source). */
export function DraggablePendingCard({ card }: { card: TimelineItem }) {
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
