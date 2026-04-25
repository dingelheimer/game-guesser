// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("returns the expected public routes", () => {
    expect(sitemap()).toEqual([
      {
        url: "https://gamester.games/",
        changeFrequency: "weekly",
        priority: 1,
      },
      {
        url: "https://gamester.games/rules",
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: "https://gamester.games/leaderboard",
        changeFrequency: "daily",
        priority: 0.7,
      },
      {
        url: "https://gamester.games/play/solo",
        changeFrequency: "monthly",
        priority: 0.6,
      },
    ]);
  });
});
