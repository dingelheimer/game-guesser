import type { DifficultyTier } from "@/types/supabase";

const DIFFICULTY_LABELS: Record<DifficultyTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  extreme: "Extreme",
};

export function getSoloDifficultyLabel(difficulty: DifficultyTier): string {
  return DIFFICULTY_LABELS[difficulty];
}

interface SoloShareSummaryInput {
  difficulty: DifficultyTier | null;
  score: number;
  turnsPlayed: number;
}

interface ShareClipboard {
  writeText: (text: string) => Promise<void>;
}

interface ShareNotifier {
  success: (title: string, options: { description: string }) => void;
  error: (title: string, options: { description: string }) => void;
}

export function buildSoloShareSummary({
  difficulty,
  score,
  turnsPlayed,
}: SoloShareSummaryInput): string {
  const safeScore = Math.max(0, score);
  const safeTurnsPlayed = Math.max(safeScore, turnsPlayed);
  const correctSequence = "🟩".repeat(safeScore);
  const incorrectSequence = "🟥".repeat(Math.max(0, safeTurnsPlayed - safeScore));
  const heading =
    difficulty === null
      ? "Game Guesser Solo"
      : `Game Guesser Solo (${getSoloDifficultyLabel(difficulty)})`;

  return `${heading}\n${correctSequence}${incorrectSequence} Score: ${String(safeScore)}`;
}

export async function copySoloShareSummary({
  clipboard,
  summary,
  score,
  notify,
}: {
  clipboard: ShareClipboard | null | undefined;
  summary: string;
  score: number;
  notify: ShareNotifier;
}): Promise<void> {
  if (clipboard?.writeText === undefined) {
    notify.error("Clipboard unavailable", {
      description: "Copying only works in a secure browser context.",
    });
    return;
  }

  try {
    await clipboard.writeText(summary);
    notify.success("Share summary copied", {
      description: `${String(score)} correct placements ready to paste.`,
    });
  } catch (error: unknown) {
    notify.error("Could not copy summary", {
      description:
        error instanceof Error ? error.message : "The browser blocked clipboard access.",
    });
  }
}
