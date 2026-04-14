import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("returns the expected public routes", () => {
    expect(sitemap()).toEqual([
      {
        url: "https://gameguesser.com/",
        changeFrequency: "weekly",
        priority: 1,
      },
      {
        url: "https://gameguesser.com/rules",
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: "https://gameguesser.com/leaderboard",
        changeFrequency: "daily",
        priority: 0.7,
      },
      {
        url: "https://gameguesser.com/play/solo",
        changeFrequency: "monthly",
        priority: 0.6,
      },
    ]);
  });
});
