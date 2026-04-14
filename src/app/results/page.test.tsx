import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { encodeShareResultPayload } from "@/lib/shareResult";

describe("Results page", () => {
  it("renders a decoded shared result card", async () => {
    const encoded = encodeShareResultPayload({
      difficulty: "hard",
      mode: "multiplayer",
      outcomes: ["correct", "correct", "close", "wrong"],
      platformBonusEarned: 2,
      platformBonusOpportunities: 3,
      placement: 1,
      playerCount: 4,
      score: 3,
      turnsPlayed: 4,
      yearRange: { end: 2019, start: 1998 },
    });

    const { default: ResultsPage } = await import("./page");
    render(await ResultsPage({ searchParams: Promise.resolve({ d: encoded }) }));

    expect(screen.getByRole("heading", { name: "Game Guesser Multiplayer Result" })).toBeVisible();
    expect(screen.getByText("🟩🟩🟨🟥")).toBeVisible();
    expect(screen.getByText("3/4")).toBeVisible();
    expect(screen.getByText("1998 → 2019")).toBeVisible();
    expect(screen.getByText("Finished #1 out of 4 players.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Play Solo" })).toHaveAttribute(
      "href",
      "https://gameguesser.com/play/solo",
    );
  });

  it("renders a graceful fallback when the payload is invalid", async () => {
    const { default: ResultsPage } = await import("./page");
    render(await ResultsPage({ searchParams: Promise.resolve({ d: "not-valid" }) }));

    expect(screen.getByRole("heading", { name: "Result not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "https://gameguesser.com/",
    );
  });

  it("builds result-specific metadata with the dynamic OG image", async () => {
    const encoded = encodeShareResultPayload({
      difficulty: "medium",
      mode: "solo",
      outcomes: ["correct", "wrong"],
      platformBonusEarned: 1,
      platformBonusOpportunities: 1,
      score: 1,
      turnsPlayed: 2,
      yearRange: { end: 2004, start: 1999 },
    });

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ d: encoded }),
    });

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: `https://gameguesser.com/api/og?d=${encoded}`,
      }),
    ]);
    expect(metadata.title).toBe("Solo result");
  });
});
