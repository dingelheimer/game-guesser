// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { cn } from "@/lib/utils";
import type { TimelineItem } from "@/components/game/Timeline";

// ── describeTimelineSlot ──────────────────────────────────────────────────────

export function describeTimelineSlot(placedCards: TimelineItem[], position: number): string {
  const previousCard = position > 0 ? placedCards[position - 1] : undefined;
  const nextCard = placedCards[position];

  if (previousCard !== undefined && nextCard !== undefined) {
    return `between ${previousCard.title} (${String(previousCard.releaseYear)}) and ${nextCard.title} (${String(nextCard.releaseYear)})`;
  }

  if (previousCard !== undefined) {
    return `after ${previousCard.title} (${String(previousCard.releaseYear)})`;
  }

  if (nextCard !== undefined) {
    return `before ${nextCard.title} (${String(nextCard.releaseYear)})`;
  }

  return "as the first card on the timeline";
}

// ── StatCard ──────────────────────────────────────────────────────────────────

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-800/80 rounded-2xl border border-white/10 p-4 backdrop-blur">
      <p className="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
        {label}
      </p>
      <p className="text-text-primary mt-2 font-mono text-4xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ── SlotPreview ───────────────────────────────────────────────────────────────

export function SlotPreview({ active, label }: { active: boolean; label: string }) {
  return (
    <div
      className={cn(
        "flex h-24 w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-dashed px-2 text-center",
        active
          ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_18px_rgba(52,211,153,0.25)]"
          : "bg-surface-900/60 border-white/12",
      )}
      aria-label={active ? `Correct slot: ${label}` : `Timeline slot: ${label}`}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn("w-1 rounded-full", active ? "h-12 bg-emerald-400" : "h-8 bg-white/20")}
        />
        <span
          className={cn(
            "text-[10px] font-semibold tracking-[0.18em] uppercase",
            active ? "text-emerald-300" : "text-text-secondary/60",
          )}
        >
          {active ? "Place" : "Slot"}
        </span>
      </div>
    </div>
  );
}

// ── TimelineCardPreview ───────────────────────────────────────────────────────

export function TimelineCardPreview({ card }: { card: TimelineItem }) {
  return (
    <div className="bg-surface-800/70 flex w-28 shrink-0 flex-col rounded-2xl border border-white/10 p-3">
      <span className="text-primary-300 font-mono text-xs font-semibold tabular-nums">
        {card.releaseYear}
      </span>
      <span className="text-text-primary mt-2 line-clamp-2 text-sm font-medium">{card.title}</span>
    </div>
  );
}
