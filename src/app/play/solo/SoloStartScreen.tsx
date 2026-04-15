// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DifficultyTier } from "@/lib/difficulty";
import { Shield, Zap, Flame, Skull } from "lucide-react";
import type { HouseRuleParams, LobbyGenre, LobbySettings } from "@/lib/multiplayer/lobby";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// ── House rules options ───────────────────────────────────────────────────────

const PLATFORM_FAMILIES = [
  { value: "nintendo", label: "Nintendo" },
  { value: "playstation", label: "PlayStation" },
  { value: "xbox", label: "Xbox" },
  { value: "pc", label: "PC" },
  { value: "sega", label: "Sega" },
] as const;

const DECADE_OPTIONS = [
  { value: 1980, label: "1980s" },
  { value: 1990, label: "1990s" },
  { value: 2000, label: "2000s" },
  { value: 2010, label: "2010s" },
  { value: 2020, label: "2020s" },
] as const;

const VARIANTS: {
  value: LobbySettings["variant"];
  label: string;
  description: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Optional platform bonus for extra points",
  },
  {
    value: "pro",
    label: "PRO",
    description: "Platform bonus is required to keep the card",
  },
  {
    value: "expert",
    label: "Expert",
    description: "Future advanced ruleset",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export interface SoloStartScreenProps {
  genres: readonly LobbyGenre[];
  disabled?: boolean;
  onSelect: (
    difficulty: DifficultyTier,
    houseRules: HouseRuleParams,
    variant: LobbySettings["variant"],
  ) => void;
}

/**
 * Start screen for solo mode: difficulty tiles + optional house rule filters.
 */
export function SoloStartScreen({ genres, disabled = false, onSelect }: SoloStartScreenProps) {
  const [houseRulesOpen, setHouseRulesOpen] = useState(false);
  const [variant, setVariant] = useState<LobbySettings["variant"]>("standard");
  const [houseRules, setHouseRules] = useState<HouseRuleParams>({
    genreLockId: null,
    consoleLockFamily: null,
    decadeStart: null,
  });

  function patch(partial: Partial<HouseRuleParams>) {
    setHouseRules((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-text-primary text-4xl font-bold">Solo Mode</h1>
        <p className="text-text-secondary mt-2">
          Place games in chronological order. One wrong placement ends the game.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-3">
        <div className="text-center">
          <p className="text-text-secondary text-xs font-medium tracking-wider uppercase">
            Variant
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {VARIANTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setVariant(option.value);
              }}
              disabled={disabled}
              className={cn(
                "rounded-xl border p-4 text-left transition-all duration-150",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                variant === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border/40 bg-surface-800 hover:border-primary/40 hover:bg-surface-700/70",
              )}
            >
              <div className="text-text-primary font-display text-base font-bold">
                {option.label}
              </div>
              <div className="text-text-secondary mt-1 text-sm">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* House rules collapsible */}
      <div className="w-full max-w-lg">
        <Button
          type="button"
          variant="ghost"
          className="text-text-secondary hover:text-text-primary flex w-full items-center justify-between text-sm font-medium"
          onClick={() => {
            setHouseRulesOpen((prev) => !prev);
          }}
          disabled={disabled}
        >
          House Rules (optional)
          {houseRulesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {houseRulesOpen && (
          <div className="border-border/40 mt-3 grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
            {/* Genre Lock */}
            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs font-medium">Genre Lock</label>
              <Select
                disabled={disabled}
                value={houseRules.genreLockId !== null ? String(houseRules.genreLockId) : "none"}
                onValueChange={(val) => {
                  patch({ genreLockId: val === "none" ? null : Number(val) });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any genre</SelectItem>
                  {genres.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Console Lock */}
            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs font-medium">Console Lock</label>
              <Select
                disabled={disabled}
                value={houseRules.consoleLockFamily ?? "none"}
                onValueChange={(val) => {
                  patch({ consoleLockFamily: val === "none" ? null : val });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any platform</SelectItem>
                  {PLATFORM_FAMILIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Decade Mode */}
            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs font-medium">Decade Mode</label>
              <Select
                disabled={disabled}
                value={houseRules.decadeStart !== null ? String(houseRules.decadeStart) : "none"}
                onValueChange={(val) => {
                  patch({ decadeStart: val === "none" ? null : Number(val) });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any decade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any decade</SelectItem>
                  {DECADE_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Difficulty tiles */}
      <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        {DIFFICULTIES.map(
          ({ tier, label, description, Icon, colorClass, borderClass, bgClass }) => (
            <button
              key={tier}
              onClick={() => {
                onSelect(tier, houseRules, variant);
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
