// SPDX-License-Identifier: AGPL-3.0-only
import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DailyLeaderboard } from "./DailyLeaderboard";
import type { DailyLeaderboardEntry, DailyPlayerRank } from "@/lib/daily/leaderboard";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<DailyLeaderboardEntry> = {}): DailyLeaderboardEntry {
  return {
    rank: 1,
    userId: "user-1",
    username: "Alice",
    score: 10,
    extraTryUsed: false,
    completedAt: "2026-04-22T10:00:00Z",
    ...overrides,
  };
}

const SAMPLE_ENTRIES: DailyLeaderboardEntry[] = [
  makeEntry({ rank: 1, userId: "user-1", username: "Alice", score: 10 }),
  makeEntry({ rank: 2, userId: "user-2", username: "Bob", score: 8, extraTryUsed: true }),
  makeEntry({ rank: 3, userId: "user-3", username: "Carol", score: 7 }),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DailyLeaderboard", () => {
  describe("loading state", () => {
    it("shows a loading spinner when isLoading is true", () => {
      render(<DailyLeaderboard entries={[]} playerRank={null} currentUserId={null} isLoading />);
      expect(screen.getByText(/loading leaderboard/i)).toBeInTheDocument();
    });

    it("does not show the table while loading", () => {
      render(
        <DailyLeaderboard
          entries={SAMPLE_ENTRIES}
          playerRank={null}
          currentUserId={null}
          isLoading
        />,
      );
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows an error message when error is set", () => {
      render(
        <DailyLeaderboard
          entries={[]}
          playerRank={null}
          currentUserId={null}
          error="network error"
        />,
      );
      expect(screen.getByText(/could not load leaderboard/i)).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows 'No scores yet' when entries is empty", () => {
      render(<DailyLeaderboard entries={[]} playerRank={null} currentUserId={null} />);
      expect(screen.getByText(/no scores yet/i)).toBeInTheDocument();
    });
  });

  describe("leaderboard table", () => {
    it("renders all entries", () => {
      render(<DailyLeaderboard entries={SAMPLE_ENTRIES} playerRank={null} currentUserId={null} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Carol")).toBeInTheDocument();
    });

    it("shows rank labels with medal emojis for top 3", () => {
      render(<DailyLeaderboard entries={SAMPLE_ENTRIES} playerRank={null} currentUserId={null} />);
      expect(screen.getByText("🥇")).toBeInTheDocument();
      expect(screen.getByText("🥈")).toBeInTheDocument();
      expect(screen.getByText("🥉")).toBeInTheDocument();
    });

    it("shows #N for ranks beyond 3", () => {
      const entries = [
        ...SAMPLE_ENTRIES,
        makeEntry({ rank: 4, userId: "user-4", username: "Dave", score: 6 }),
      ];
      render(<DailyLeaderboard entries={entries} playerRank={null} currentUserId={null} />);
      expect(screen.getByText("#4")).toBeInTheDocument();
    });

    it("shows 💪 for clean runs and ❤️ for extra try used", () => {
      render(<DailyLeaderboard entries={SAMPLE_ENTRIES} playerRank={null} currentUserId={null} />);
      // Alice: clean run → 💪; Bob: extra try → ❤️
      const cleanRuns = screen.getAllByTitle("Clean run");
      const extraTries = screen.getAllByTitle("Extra try used");
      expect(cleanRuns.length).toBeGreaterThan(0);
      expect(extraTries.length).toBeGreaterThan(0);
    });

    it("highlights the current user's row with '(you)' label", () => {
      render(
        <DailyLeaderboard entries={SAMPLE_ENTRIES} playerRank={null} currentUserId="user-2" />,
      );
      expect(screen.getByText("(you)")).toBeInTheDocument();
    });

    it("does not show '(you)' when currentUserId is null", () => {
      render(<DailyLeaderboard entries={SAMPLE_ENTRIES} playerRank={null} currentUserId={null} />);
      expect(screen.queryByText("(you)")).not.toBeInTheDocument();
    });
  });

  describe("player rank outside top results", () => {
    const outsideRank: DailyPlayerRank = {
      rank: 99,
      score: 3,
      extraTryUsed: false,
      completedAt: "2026-04-22T23:00:00Z",
    };

    it("shows the player rank banner when playerRank is set and user not in entries", () => {
      render(
        <DailyLeaderboard
          entries={SAMPLE_ENTRIES}
          playerRank={outsideRank}
          currentUserId="user-outsider"
        />,
      );
      expect(screen.getByText(/your rank/i)).toBeInTheDocument();
      expect(screen.getByText("#99")).toBeInTheDocument();
    });

    it("does not show the player rank banner when the player is already in the list", () => {
      render(
        <DailyLeaderboard
          entries={SAMPLE_ENTRIES}
          playerRank={outsideRank}
          currentUserId="user-1"
        />,
      );
      expect(screen.queryByText(/your rank/i)).not.toBeInTheDocument();
    });

    it("does not show the player rank banner when playerRank is null", () => {
      render(
        <DailyLeaderboard
          entries={SAMPLE_ENTRIES}
          playerRank={null}
          currentUserId="user-outsider"
        />,
      );
      expect(screen.queryByText(/your rank/i)).not.toBeInTheDocument();
    });
  });

  describe("guest sign-up prompt", () => {
    it("shows sign-up prompt for guests (null currentUserId)", () => {
      render(<DailyLeaderboard entries={SAMPLE_ENTRIES} playerRank={null} currentUserId={null} />);
      expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    });

    it("does not show sign-up prompt for authenticated users", () => {
      render(
        <DailyLeaderboard entries={SAMPLE_ENTRIES} playerRank={null} currentUserId="user-1" />,
      );
      expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    });
  });

  describe("preview mode", () => {
    it("shows 'View full leaderboard' link in preview mode", () => {
      render(
        <DailyLeaderboard
          entries={SAMPLE_ENTRIES}
          playerRank={null}
          currentUserId={null}
          isPreview
          fullLeaderboardHref="/daily/leaderboard?challenge=42"
        />,
      );
      expect(screen.getByText(/view full leaderboard/i)).toBeInTheDocument();
    });

    it("does not show 'View full leaderboard' link when not in preview mode", () => {
      render(
        <DailyLeaderboard
          entries={SAMPLE_ENTRIES}
          playerRank={null}
          currentUserId={null}
          isPreview={false}
          fullLeaderboardHref="/daily/leaderboard?challenge=42"
        />,
      );
      expect(screen.queryByText(/view full leaderboard/i)).not.toBeInTheDocument();
    });

    it("slices to top 10 in preview mode", () => {
      const many = Array.from({ length: 15 }, (_, i) =>
        makeEntry({
          rank: i + 1,
          userId: `user-${String(i + 1)}`,
          username: `Player${String(i + 1)}`,
          score: 10 - i,
        }),
      );
      render(<DailyLeaderboard entries={many} playerRank={null} currentUserId={null} isPreview />);
      // Players 11–15 should not be visible in preview
      expect(screen.queryByText("Player11")).not.toBeInTheDocument();
      expect(screen.getByText("Player10")).toBeInTheDocument();
    });
  });
});
