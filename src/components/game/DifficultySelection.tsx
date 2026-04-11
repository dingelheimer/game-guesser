"use client";

import { cn } from "@/lib/utils";
import type { DifficultyTier } from "@/lib/difficulty";
import { Shield, Zap, Flame, Skull } from "lucide-react";

// ── Difficulty config ─────────────────────────────────────────────────────────

const DIFFICULTIES: {
  tier: DifficultyTier;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  borderClass: string;
  bgClass: string;
}[] = [
  {
    tier: "easy",
    label: "Easy",
    description: "Top 10 games per year — household names",
    Icon: Shield,
    colorClass: "text-emerald-400",
    borderClass: "border-emerald-500/40 hover:border-emerald-400",
    bgClass: "hover:bg-emerald-500/10",
  },
  {
    tier: "medium",
    label: "Medium",
    description: "Top 20 games per year — genre classics",
    Icon: Zap,
    colorClass: "text-sky-400",
    borderClass: "border-sky-500/40 hover:border-sky-400",
    bgClass: "hover:bg-sky-500/10",
  },
  {
    tier: "hard",
    label: "Hard",
    description: "Top 50 games per year — deep cuts",
    Icon: Flame,
    colorClass: "text-orange-400",
    borderClass: "border-orange-500/40 hover:border-orange-400",
    bgClass: "hover:bg-orange-500/10",
  },
  {
    tier: "extreme",
    label: "Extreme",
    description: "All games — true completionists only",
    Icon: Skull,
    colorClass: "text-rose-400",
    borderClass: "border-rose-500/40 hover:border-rose-400",
    bgClass: "hover:bg-rose-500/10",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export interface DifficultySelectionProps {
  onSelect: (difficulty: DifficultyTier) => void;
  disabled?: boolean;
}

export function DifficultySelection({ onSelect, disabled = false }: DifficultySelectionProps) {
  return (
    <div className="flex flex-col items-center gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-text-primary text-4xl font-bold">Solo Mode</h1>
        <p className="text-text-secondary mt-2">
          Place games in chronological order. One wrong placement ends the game.
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        {DIFFICULTIES.map(
          ({ tier, label, description, Icon, colorClass, borderClass, bgClass }) => (
            <button
              key={tier}
              onClick={() => {
                onSelect(tier);
              }}
              disabled={disabled}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-5 text-left",
                "bg-surface-800 transition-all duration-150",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                borderClass,
                bgClass,
              )}
              aria-label={`${label} difficulty: ${description}`}
            >
              <Icon className={cn("size-7", colorClass)} />
              <div>
                <div className={cn("font-display text-lg font-bold", colorClass)}>{label}</div>
                <div className="text-text-secondary mt-0.5 text-sm">{description}</div>
              </div>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
