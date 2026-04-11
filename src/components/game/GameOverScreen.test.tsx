import type { ComponentProps } from "react";
import type React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameOverScreen } from "./GameOverScreen";
import type { TimelineItem } from "./Timeline";
import type { RevealedCardData } from "@/lib/solo/api";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    section: ({ children, ...props }: ComponentProps<"section">) => (
      <section {...props}>{children}</section>
    ),
  },
}));

vi.mock("./GameCard", () => ({
  GameCard: ({ title, releaseYear }: { title: string; releaseYear: number }) => (
    <div data-testid="game-card">
      {title} ({String(releaseYear)})
    </div>
  ),
}));

const timelineItems: TimelineItem[] = [
  {
    id: "1",
    screenshotImageId: "shot_1",
    coverImageId: "cover_1",
    title: "Resident Evil 4",
    releaseYear: 2005,
    platform: "GameCube",
    isRevealed: true,
  },
  {
    id: "2",
    screenshotImageId: "shot_2",
    coverImageId: "cover_2",
    title: "Halo 3",
    releaseYear: 2007,
    platform: "Xbox 360",
    isRevealed: true,
  },
];

const failedCard: RevealedCardData = {
  game_id: 3,
  name: "Metroid Prime 3: Corruption",
  release_year: 2007,
  cover_image_id: "cover_3",
  screenshot_image_ids: ["shot_3"],
  platform_names: ["Wii"],
};

describe("GameOverScreen", () => {
  afterEach(cleanup);

  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the final stats, failed card, and highlighted correct position", () => {
    render(
      <GameOverScreen
        difficulty="hard"
        score={4}
        turnsPlayed={5}
        bestStreak={4}
        bonusPointsEarned={2}
        bonusOpportunities={4}
        timelineItems={timelineItems}
        failedCard={failedCard}
        validPositions={[2]}
        endedOnIncorrectPlacement
        username={null}
        scoreStatus="idle"
        onPlayAgain={vi.fn()}
        onChangeDifficulty={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Game Over" })).toBeInTheDocument();
    expect(screen.getByText("Metroid Prime 3: Corruption (2007)")).toBeInTheDocument();
    expect(screen.getByText("Final score")).toBeInTheDocument();
    expect(screen.getByText("Turns played")).toBeInTheDocument();
    expect(screen.getByText("Best streak")).toBeInTheDocument();
    expect(screen.getByText(/Platform Bonuses:/i)).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByLabelText(/Correct slot:/)).toBeInTheDocument();
  });

  it("renders the share preview and share button", () => {
    render(
      <GameOverScreen
        difficulty="easy"
        score={2}
        turnsPlayed={3}
        bestStreak={2}
        bonusPointsEarned={1}
        bonusOpportunities={2}
        timelineItems={timelineItems}
        failedCard={failedCard}
        validPositions={[1]}
        endedOnIncorrectPlacement
        username={null}
        scoreStatus="idle"
        onPlayAgain={vi.fn()}
        onChangeDifficulty={vi.fn()}
      />,
    );

    expect(screen.getByText("Share preview")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => {
        return element?.textContent === "Game Guesser Solo (Easy)\n🟩🟩🟥 Score: 2";
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share Result" })).toBeInTheDocument();
  });

  it("shows every valid slot when same-year adjacency allows multiple answers", () => {
    render(
      <GameOverScreen
        difficulty="medium"
        score={6}
        turnsPlayed={7}
        bestStreak={6}
        bonusPointsEarned={0}
        bonusOpportunities={0}
        timelineItems={timelineItems}
        failedCard={failedCard}
        validPositions={[1, 2]}
        endedOnIncorrectPlacement
        username={null}
        scoreStatus="idle"
        onPlayAgain={vi.fn()}
        onChangeDifficulty={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Any highlighted slot would have counted because the release year matched the neighboring cards.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Correct slot:/)).toHaveLength(2);
    expect(screen.queryByText(/Platform Bonuses:/i)).not.toBeInTheDocument();
  });
});
