// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, landingHeroMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  landingHeroMock: vi.fn(({ primaryCtaLabel }: { primaryCtaLabel: string }) => (
    <div data-testid="landing-hero">
      <a href="/play/solo">{primaryCtaLabel}</a>
      <a href="/play">Play with Friends</a>
      <a href="/leaderboard">Leaderboard</a>
    </div>
  )),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock("@/app/_components/LandingHero", () => ({
  LandingHero: landingHeroMock,
}));

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the guest CTA and landing-page sections", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(screen.getByRole("link", { name: "Play Now" })).toHaveAttribute("href", "/play/solo");
    expect(
      screen.getByRole("heading", { name: /learn the loop in three quick steps/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: /built for quick sessions, rematches, and one-more-run energy/i,
      }),
    ).toBeVisible();
  });

  it("uses the authenticated primary CTA label", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
    });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(screen.getByRole("link", { name: "Continue Playing" })).toHaveAttribute(
      "href",
      "/play/solo",
    );
  });

  it("exports keyword-rich landing metadata", async () => {
    const { metadata } = await import("./page");

    expect(metadata).toMatchObject({
      title: "Guess the Video Game by Screenshot & Release Year",
      description: expect.stringContaining("video game guessing game"),
    });
  });
});
