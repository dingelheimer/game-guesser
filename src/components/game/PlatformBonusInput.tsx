"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlatformOption } from "@/stores/soloGameStore";

export interface PlatformBonusInputProps {
  platforms: PlatformOption[];
  correctPlatformIds: number[];
  result: "correct" | "incorrect" | null;
  onSubmit: (selectedIds: number[]) => void;
}

export function PlatformBonusInput({
  platforms,
  correctPlatformIds,
  result,
  onSubmit,
}: PlatformBonusInputProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const reduceMotion = useReducedMotion();

  const submitted = result !== null;
  const correctSet = new Set(correctPlatformIds);

  function toggleChip(id: number) {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (submitted || selected.size === 0) return;
    onSubmit([...selected]);
  }

  function chipVariant(id: number): string {
    if (!submitted) {
      return selected.has(id)
        ? "bg-sky-500/30 text-sky-300 border-sky-500/60 ring-1 ring-sky-500/40"
        : "bg-surface-700/60 text-text-secondary border-white/10 hover:border-white/20 hover:text-text-primary";
    }
    if (result === "correct") {
      return "bg-emerald-500/30 text-emerald-300 border-emerald-500/50";
    }
    // incorrect result — show correct in green, wrong selections in red, rest dimmed
    if (correctSet.has(id)) {
      return "bg-emerald-500/30 text-emerald-300 border-emerald-500/50";
    }
    if (selected.has(id)) {
      return "bg-rose-500/30 text-rose-300 border-rose-500/50";
    }
    return "bg-surface-700/30 text-text-secondary/30 border-white/5";
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <p className="text-text-secondary text-center text-sm font-medium">
        Which platforms is this game on? Select all that apply.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            type="button"
            onClick={() => { toggleChip(platform.id); }}
            disabled={submitted}
            aria-pressed={selected.has(platform.id)}
            className={cn(
              "min-h-[44px] rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
              chipVariant(platform.id),
              !submitted && "cursor-pointer",
              submitted && "cursor-default",
            )}
          >
            {platform.name}
          </button>
        ))}
      </div>

      {!submitted && (
        <Button
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className="w-full"
          aria-label="Confirm platform selection"
        >
          Confirm
        </Button>
      )}

      {submitted && (
        <motion.div
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold",
            result === "correct"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-rose-500/15 text-rose-400",
          )}
          initial={reduceMotion === true ? {} : { opacity: 0, scale: 0.9 }}
          animate={reduceMotion === true ? {} : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
        >
          {result === "correct"
            ? "🎮 +1 bonus!"
            : "✗ Not quite — correct platforms are highlighted"}
        </motion.div>
      )}
    </div>
  );
}
