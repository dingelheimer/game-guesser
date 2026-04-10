"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DifficultySelection } from "@/components/game/DifficultySelection";
import { SoloGame } from "@/components/game/SoloGame";
import { useSoloGameStore } from "@/stores/soloGameStore";

export function SoloGamePage() {
  const phase = useSoloGameStore((s) => s.phase);
  const startGame = useSoloGameStore((s) => s.startGame);

  return (
    <AnimatePresence mode="wait">
      {phase === "idle" && (
        <motion.div
          key="difficulty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DifficultySelection onSelect={(d) => void startGame(d)} />
        </motion.div>
      )}

      {phase === "starting" && (
        <motion.div
          key="loading"
          className="flex min-h-[60vh] items-center justify-center gap-3 text-text-secondary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-busy="true"
          aria-label="Starting game…"
        >
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <span>Setting up your game…</span>
        </motion.div>
      )}

      {(phase === "placing" ||
        phase === "submitting" ||
        phase === "revealing" ||
        phase === "game_over") && (
        <motion.div
          key="game"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <SoloGame />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
