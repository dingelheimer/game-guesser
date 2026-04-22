// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { DailyGame } from "@/components/game/DailyGame";
import { useDailyGameStore } from "@/stores/dailyGameStore";
import { MOTION } from "@/lib/motion";
import { Button } from "@/components/ui/button";

export function DailyGamePage() {
  const phase = useDailyGameStore((s) => s.phase);
  const error = useDailyGameStore((s) => s.error);
  const startDaily = useDailyGameStore((s) => s.startDaily);

  const handleStart = useCallback(() => {
    void startDaily();
  }, [startDaily]);

  // Auto-start on mount; a manual retry button handles re-attempts after failure.
  useEffect(() => {
    if (phase === "idle") {
      void startDaily();
    }
    // intentionally empty deps — runs once on mount only
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {phase === "loading" && (
        <motion.div
          key="loading"
          className="text-text-secondary flex flex-1 flex-col items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.fast }}
          aria-busy="true"
          aria-label="Loading today's challenge…"
        >
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <span>Loading today's challenge…</span>
        </motion.div>
      )}

      {phase === "idle" && error !== null && (
        <motion.div
          key="error"
          className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.fast }}
        >
          <AlertTriangle className="text-rose-400 size-8" aria-hidden="true" />
          <p className="text-text-secondary max-w-sm text-sm">{error}</p>
          <Button onClick={handleStart} variant="outline" size="sm">
            Try Again
          </Button>
        </motion.div>
      )}

      {(phase === "placing" ||
        phase === "submitting" ||
        phase === "revealing" ||
        phase === "game_over") && (
        <motion.div
          key="game"
          className="flex flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.fast }}
        >
          <DailyGame />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
