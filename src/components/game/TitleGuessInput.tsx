"use client";

import { useState } from "react";
import Fuse from "fuse.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TitleGuessInputProps {
  correctTitle: string;
  result: "correct" | "incorrect" | null;
  onSubmit: (guess: string) => void;
  /** Already submitted — hide the input, show result only. */
  submitted?: boolean;
}

/** Fuzzy-match threshold: 0 = exact, 1 = anything matches. */
const FUSE_THRESHOLD = 0.4;

export function isTitleMatch(guess: string, correctTitle: string): boolean {
  if (guess.trim() === "") return false;
  const fuse = new Fuse([{ title: correctTitle }], {
    keys: ["title"],
    threshold: FUSE_THRESHOLD,
  });
  return fuse.search(guess).length > 0;
}

export function TitleGuessInput({
  correctTitle,
  result,
  onSubmit,
  submitted = false,
}: TitleGuessInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (value.trim() === "") return;
    onSubmit(value.trim());
  }

  if (submitted && result !== null) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold",
          result === "correct"
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-rose-500/15 text-rose-400",
        )}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">{result === "correct" ? "🎯" : "✗"}</span>
        {result === "correct" ? (
          <span>Title correct! +1 bonus</span>
        ) : (
          <span>
            Incorrect — it was <strong>{correctTitle}</strong>
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm gap-2">
      <Input
        value={value}
        onChange={(e) => { setValue(e.target.value); }}
        placeholder="Guess the game title…"
        aria-label="Game title guess"
        autoComplete="off"
        autoFocus
      />
      <Button type="submit" variant="outline" size="sm" disabled={value.trim() === ""}>
        Guess
      </Button>
    </form>
  );
}
