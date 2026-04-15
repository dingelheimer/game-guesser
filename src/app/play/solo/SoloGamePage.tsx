// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SoloGame } from "@/components/game/SoloGame";
import { submitScoreAction } from "@/lib/auth/actions";
import { useSoloGameStore } from "@/stores/soloGameStore";
import type { LobbyGenre } from "@/lib/multiplayer/lobby";
import { SoloStartScreen } from "./SoloStartScreen";
import { MOTION } from "@/lib/motion";

interface PendingScore {
  score: number;
  streak: number;
  timestamp: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function SoloGamePage({
  username,
  hasPendingScore,
  genres,
}: {
  username: string | null;
  hasPendingScore: boolean;
  genres: readonly LobbyGenre[];
}) {
  const phase = useSoloGameStore((s) => s.phase);
  const startGame = useSoloGameStore((s) => s.startGame);
  const router = useRouter();

  // On mount, submit pending score if user just signed up/logged in
  useEffect(() => {
    if (!hasPendingScore) return;

    // Clean up the ?saved=pending query param regardless of outcome
    router.replace("/play/solo", { scroll: false });

    const raw = sessionStorage.getItem("pending_score");
    if (raw === null) return;

    let pending: PendingScore;
    try {
      pending = JSON.parse(raw) as PendingScore;
    } catch {
      sessionStorage.removeItem("pending_score");
      return;
    }

    sessionStorage.removeItem("pending_score");

    // Silently discard stale scores (> 1 hour old)
    if (Date.now() - pending.timestamp > ONE_HOUR_MS) return;

    void submitScoreAction(pending.score, pending.streak).then((result) => {
      if ("success" in result) {
        toast.success("Score saved! Your score has been added to the leaderboard.");
      } else {
        toast.error(`Could not save score: ${result.error}`);
      }
    });
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {phase === "idle" && (
        <motion.div
          key="difficulty"
          className="flex flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.fast }}
        >
          <SoloStartScreen
            genres={genres}
            onSelect={(d, hr, variant) => void startGame(d, hr, variant)}
          />
        </motion.div>
      )}

      {phase === "starting" && (
        <motion.div
          key="loading"
          className="text-text-secondary flex flex-1 flex-col items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.fast }}
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
          className="flex flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.fast }}
        >
          <SoloGame username={username} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
