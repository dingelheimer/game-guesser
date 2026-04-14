import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("Rules page", () => {
  it("renders the how-to-play guide cards and FAQ content", async () => {
    const { default: RulesPage } = await import("./page");
    render(<RulesPage />);

    expect(
      screen.getByRole("heading", { name: /learn game guesser in a couple of rounds/i }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Platform Bonus" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Solo Endless" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Multiplayer" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Tokens & Challenges" })).toBeVisible();
    expect(screen.getByRole("heading", { name: /how many players can play\?/i })).toBeVisible();
  });

  it("exports page metadata and FAQ structured data", async () => {
    const pageModule = await import("./page");
    const { container } = render(<pageModule.default />);

    expect(pageModule.metadata).toMatchObject({
      title: {
        absolute: "How to Play | Game Guesser",
      },
      description: expect.stringContaining("master platform bonuses"),
    });

    const structuredData = container.querySelector('script[type="application/ld+json"]');
    expect(structuredData).not.toBeNull();
    expect(structuredData?.textContent).toContain('"@type":"FAQPage"');
    expect(structuredData?.textContent).toContain("How do I play Game Guesser?");
    expect(structuredData?.textContent).toContain("How many players can play?");
    expect(structuredData?.textContent).toContain("Is Game Guesser free?");
  });
});
