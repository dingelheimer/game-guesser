// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyChallengeStatus } from "@/lib/daily/status.server";

const { getUserMock, fetchDailyStatusMock, landingHeroMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fetchDailyStatusMock: vi.fn(),
  landingHeroMock: vi.fn(
    ({ dailyChallengeStatus }: { dailyChallengeStatus: DailyChallengeStatus }) => (
      <div data-testid="landing-hero" data-daily-state={dailyChallengeStatus.state}>
        {dailyChallengeStatus.state === "not_played" && (
          <a href="/daily">Daily Challenge #{dailyChallengeStatus.challengeNumber} — Play Now</a>
        )}
        {dailyChallengeStatus.state === "guest_cta" && (
          <a href="/daily">Daily Challenge — Play Free</a>
        )}
        {dailyChallengeStatus.state === "completed" && (
          <>
            <a href="/daily">View Result</a>
            <a href="/play/solo">Play Solo Endless</a>
          </>
        )}
        {dailyChallengeStatus.state === "no_challenge" && <a href="/play/solo">Play Now</a>}
        <a href="/play">Play with Friends</a>
      </div>
    ),
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock("@/lib/daily/status.server", () => ({
  fetchDailyChallengeStatus: fetchDailyStatusMock,
}));

vi.mock("@/app/_components/LandingHero", () => ({
  LandingHero: landingHeroMock,
}));

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders guest CTA and how-it-works section when no challenge exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    fetchDailyStatusMock.mockResolvedValue({ state: "no_challenge" });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(screen.getByTestId("landing-hero")).toHaveAttribute("data-daily-state", "no_challenge");
    expect(screen.getByRole("link", { name: "Play Now" })).toHaveAttribute("href", "/play/solo");
    expect(screen.getByRole("heading", { name: /see the screenshot/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /place it on your timeline/i })).toBeInTheDocument();
  });

  it("renders guest_cta when user is unauthenticated and a challenge is available", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    fetchDailyStatusMock.mockResolvedValue({
      state: "guest_cta",
      challengeNumber: 42,
      challengeDate: "2026-04-22",
    });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(screen.getByTestId("landing-hero")).toHaveAttribute("data-daily-state", "guest_cta");
    expect(screen.getByRole("link", { name: "Daily Challenge — Play Free" })).toHaveAttribute(
      "href",
      "/daily",
    );
  });

  it("renders not_played CTA for an authenticated user who hasn't played today", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    fetchDailyStatusMock.mockResolvedValue({
      state: "not_played",
      challengeNumber: 42,
      challengeDate: "2026-04-22",
    });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(screen.getByTestId("landing-hero")).toHaveAttribute("data-daily-state", "not_played");
    expect(screen.getByRole("link", { name: "Daily Challenge #42 — Play Now" })).toHaveAttribute(
      "href",
      "/daily",
    );
  });

  it("renders completed CTA with View Result link when user finished today", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    fetchDailyStatusMock.mockResolvedValue({
      state: "completed",
      challengeNumber: 42,
      challengeDate: "2026-04-22",
      score: 9,
      totalCards: 10,
      currentStreak: 5,
    });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(screen.getByTestId("landing-hero")).toHaveAttribute("data-daily-state", "completed");
    expect(screen.getByRole("link", { name: "View Result" })).toHaveAttribute("href", "/daily");
    expect(screen.getByRole("link", { name: "Play Solo Endless" })).toHaveAttribute(
      "href",
      "/play/solo",
    );
  });

  it("passes userId from authenticated user to fetchDailyChallengeStatus", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-456" } } });
    fetchDailyStatusMock.mockResolvedValue({ state: "no_challenge" });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(fetchDailyStatusMock).toHaveBeenCalledWith("user-456");
  });

  it("passes null to fetchDailyChallengeStatus for guest users", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    fetchDailyStatusMock.mockResolvedValue({ state: "no_challenge" });

    const { default: Home } = await import("./page");
    render(await Home());

    expect(fetchDailyStatusMock).toHaveBeenCalledWith(null);
  });

  it("exports keyword-rich landing metadata", async () => {
    const { metadata } = await import("./page");

    expect(metadata).toMatchObject({
      title: "Guess the Video Game by Screenshot & Release Year",
      description: expect.stringContaining("video game guessing game"),
    });
  });
});
