// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Trophy, Zap } from "lucide-react";
import { getSoloDifficultyLabel } from "@/lib/solo/share";
import { cn } from "@/lib/utils";
import type { DifficultyTier } from "@/lib/difficulty";

const BONUS_BADGE_DURATION_MS = 1800;

interface ScoreBarProps {
  score: number;
  streak: number;
  bestStreak: number;
  difficulty: DifficultyTier;
  bonusPointsEarned: number;
}

/** Renders the solo HUD stats and briefly celebrates newly earned platform bonuses. */
export function ScoreBar({
  score,
  streak,
  bestStreak,
  difficulty,
  bonusPointsEarned,
}: ScoreBarProps) {
  const reduceMotion = useReducedMotion();
  const [showBonusBadge, setShowBonusBadge] = useState(false);
  const previousBonusPointsEarned = useRef(bonusPointsEarned);

  useEffect(() => {
    if (bonusPointsEarned <= previousBonusPointsEarned.current) {
      previousBonusPointsEarned.current = bonusPointsEarned;
      return;
    }

    previousBonusPointsEarned.current = bonusPointsEarned;
    setShowBonusBadge(true);

    const timeoutId = window.setTimeout(() => {
      setShowBonusBadge(false);
    }, BONUS_BADGE_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [bonusPointsEarned]);

  return (
    <div className="bg-surface-800/80 flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 backdrop-blur-xl">
      <div className="text-text-primary flex items-center gap-2 font-mono text-lg font-bold">
        <Trophy className="size-4 text-yellow-400" aria-hidden="true" />
        <span aria-label={`Score: ${score.toString()}`}>{score}</span>
        <AnimatePresence initial={false}>
          {showBonusBadge && (
            <motion.span
              className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300"
              initial={reduceMotion === true ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.96 }}
              animate={reduceMotion === true ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion === true ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.98 }}
              transition={{ duration: reduceMotion === true ? 0.01 : 0.2 }}
              role="status"
              aria-live="polite"
            >
              +1 bonus
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="text-text-secondary flex items-center gap-1.5 text-sm">
        <Zap className="size-3.5 text-sky-400" aria-hidden="true" />
        <span aria-label={`Current streak: ${streak.toString()}`}>×{streak}</span>
        <span className="text-text-secondary/60 text-xs">best {bestStreak.toString()}</span>
      </div>

      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          difficulty === "easy" && "bg-emerald-500/20 text-emerald-400",
          difficulty === "medium" && "bg-sky-500/20 text-sky-400",
          difficulty === "hard" && "bg-orange-500/20 text-orange-400",
          difficulty === "extreme" && "bg-rose-500/20 text-rose-400",
        )}
        aria-label={`Difficulty: ${getSoloDifficultyLabel(difficulty)}`}
      >
        {getSoloDifficultyLabel(difficulty)}
      </span>
    </div>
  );
}
