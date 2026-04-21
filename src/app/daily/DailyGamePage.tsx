// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DailyGame } from "@/components/game/DailyGame";
import { useDailyGameStore } from "@/stores/dailyGameStore";
import { MOTION } from "@/lib/motion";

export function DailyGamePage() {
  const phase = useDailyGameStore((s) => s.phase);
  const startDaily = useDailyGameStore((s) => s.startDaily);

  // Auto-start on mount: fetches today's challenge status (new, in-progress, or completed).
  useEffect(() => {
    if (phase === "idle") {
      void startDaily();
    }
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
