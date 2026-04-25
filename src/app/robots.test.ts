// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  it("allows all crawlers and points to the sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: "https://gamester.games/sitemap.xml",
    });
  });
});
