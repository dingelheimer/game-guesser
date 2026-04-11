import type { ComponentProps, ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreBar } from "./ScoreBar";

const useReducedMotionMock = vi.fn(() => false);

vi.mock("framer-motion", () => ({
  motion: {
    span: ({ children, ...props }: ComponentProps<"span">) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => useReducedMotionMock(),
}));

describe("ScoreBar", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    useReducedMotionMock.mockReturnValue(false);
  });

  it("renders score, streak, and difficulty", () => {
    render(
      <ScoreBar score={5} streak={3} bestStreak={6} difficulty="hard" bonusPointsEarned={0} />,
    );

    expect(screen.getByLabelText("Score: 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Current streak: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Difficulty: Hard")).toBeInTheDocument();
  });

  it("shows and then hides the bonus badge when a correct platform guess adds a point", () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <ScoreBar score={2} streak={2} bestStreak={4} difficulty="medium" bonusPointsEarned={0} />,
    );

    expect(screen.queryByText("+1 bonus")).not.toBeInTheDocument();

    rerender(
      <ScoreBar score={3} streak={2} bestStreak={4} difficulty="medium" bonusPointsEarned={1} />,
    );

    expect(screen.getByText("+1 bonus")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.queryByText("+1 bonus")).not.toBeInTheDocument();
  });

  it("does not show the bonus badge when the bonus total is unchanged after an incorrect or skipped bonus", () => {
    const { rerender } = render(
      <ScoreBar score={2} streak={2} bestStreak={4} difficulty="easy" bonusPointsEarned={0} />,
    );

    rerender(
      <ScoreBar score={2} streak={2} bestStreak={4} difficulty="easy" bonusPointsEarned={0} />,
    );

    expect(screen.queryByText("+1 bonus")).not.toBeInTheDocument();
  });
});
