import { describe, expect, it, vi } from "vitest";
import { buildSoloShareSummary, copySoloShareSummary, getSoloDifficultyLabel } from "./share";

describe("getSoloDifficultyLabel", () => {
  it("returns the UI label for a difficulty tier", () => {
    expect(getSoloDifficultyLabel("extreme")).toBe("Extreme");
  });
});

describe("buildSoloShareSummary", () => {
  it("builds a share string with difficulty and one failed turn", () => {
    expect(
      buildSoloShareSummary({
        difficulty: "hard",
        score: 4,
        turnsPlayed: 5,
      }),
    ).toBe("Game Guesser Solo (Hard)\n🟩🟩🟩🟩🟥 Score: 4");
  });

  it("supports all-correct runs", () => {
    expect(
      buildSoloShareSummary({
        difficulty: "easy",
        score: 3,
        turnsPlayed: 3,
      }),
    ).toBe("Game Guesser Solo (Easy)\n🟩🟩🟩 Score: 3");
  });

  it("omits the difficulty label when no difficulty is available", () => {
    expect(
      buildSoloShareSummary({
        difficulty: null,
        score: 0,
        turnsPlayed: 1,
      }),
    ).toBe("Game Guesser Solo\n🟥 Score: 0");
  });
});

describe("copySoloShareSummary", () => {
  it("copies the summary and shows a success toast", async () => {
    const writeText = vi.fn(async () => undefined);
    const success = vi.fn();
    const error = vi.fn();

    await copySoloShareSummary({
      clipboard: { writeText },
      summary: "Game Guesser Solo (Easy)\n🟩🟩🟥 Score: 2",
      score: 2,
      notify: { success, error },
    });

    expect(writeText).toHaveBeenCalledWith("Game Guesser Solo (Easy)\n🟩🟩🟥 Score: 2");
    expect(success).toHaveBeenCalledWith("Share summary copied", {
      description: "2 correct placements ready to paste.",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("shows an explicit error when clipboard access is unavailable", async () => {
    const success = vi.fn();
    const error = vi.fn();

    await copySoloShareSummary({
      clipboard: undefined,
      summary: "summary",
      score: 1,
      notify: { success, error },
    });

    expect(error).toHaveBeenCalledWith("Clipboard unavailable", {
      description: "Copying only works in a secure browser context.",
    });
    expect(success).not.toHaveBeenCalled();
  });

  it("surfaces clipboard write failures", async () => {
    const success = vi.fn();
    const error = vi.fn();

    await copySoloShareSummary({
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("Permission denied");
        }),
      },
      summary: "summary",
      score: 1,
      notify: { success, error },
    });

    expect(error).toHaveBeenCalledWith("Could not copy summary", {
      description: "Permission denied",
    });
    expect(success).not.toHaveBeenCalled();
  });
});
