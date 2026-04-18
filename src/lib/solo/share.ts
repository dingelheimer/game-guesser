// SPDX-License-Identifier: AGPL-3.0-only
import type { DifficultyTier } from "@/lib/difficulty";

const DIFFICULTY_LABELS: Record<DifficultyTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  extreme: "Extreme",
  god_gamer: "God Gamer",
};

export function getSoloDifficultyLabel(difficulty: DifficultyTier): string {
  return DIFFICULTY_LABELS[difficulty];
}
