// SPDX-License-Identifier: AGPL-3.0-only
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { buildPlacementContext, SoloResultControls } from "./SoloResultControls";
import type { SoloResultControlsProps } from "./SoloResultControls";
import type { TimelineItem } from "./Timeline";

afterEach(cleanup);

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: ComponentProps<"div">) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReducedMotion: vi.fn(() => false),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...rest }: ComponentProps<"button">) => (
    <button {...rest}>{children}</button>
  ),
}));

vi.mock("@/components/game/PlatformBonusInput", () => ({
  PlatformBonusInput: () => <div data-testid="platform-bonus-input" />,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const card1: TimelineItem = {
  id: "1",
  screenshotImageId: null,
  coverImageId: null,
  title: "Half-Life 2",
  releaseYear: 2004,
  platform: "PC",
  isRevealed: true,
};

const card2: TimelineItem = {
  id: "2",
  screenshotImageId: null,
  coverImageId: null,
  title: "Portal 2",
  releaseYear: 2011,
  platform: "PC",
  isRevealed: true,
};

const revealedCard = {
  game_id: 2,
  name: "Portal 2",
  release_year: 2011,
  cover_image_id: "cover_2",
  screenshot_image_ids: ["shot_2"],
  platform_names: ["PC"],
};

const baseProps: SoloResultControlsProps = {
  show: true,
  correct: true,
  revealedCard,
  timelineItems: [card1, card2],
  availablePlatforms: [],
  correctPlatformIds: [],
  platformBonusResult: null,
  expertVerificationResult: null,
  isProVariant: false,
  isExpertVariant: false,
  isTeamworkMode: false,
  onAdvanceTurn: vi.fn(),
  onSubmitPlatformGuess: vi.fn(),
  onSubmitExpertVerification: vi.fn(),
};

// ── buildPlacementContext ─────────────────────────────────────────────────────

describe("buildPlacementContext", () => {
  it("returns empty string when gameId is undefined", () => {
    expect(buildPlacementContext([card1], undefined)).toBe("");
  });

  it("returns empty string when the card is not found", () => {
    expect(buildPlacementContext([card1], 999)).toBe("");
  });

  it("returns 'as the only card on the timeline' when there are no neighbours", () => {
    const only: TimelineItem = { ...card1, id: "10" };
    expect(buildPlacementContext([only], 10)).toBe("as the only card on the timeline");
  });

  it("describes position between two cards", () => {
    const middle: TimelineItem = { ...card2, id: "3", title: "Minecraft", releaseYear: 2011 };
    const items = [card1, middle, { ...card1, id: "4", title: "The Witcher 3", releaseYear: 2015 }];
    expect(buildPlacementContext(items, 3)).toContain(
      "between Half-Life 2 (2004) and The Witcher 3 (2015)",
    );
  });

  it("describes position after the last card", () => {
    const last: TimelineItem = { ...card2, id: "5", title: "Elden Ring", releaseYear: 2022 };
    expect(buildPlacementContext([card1, last], 5)).toBe("after Half-Life 2 (2004)");
  });

  it("describes position before the first card", () => {
    const first: TimelineItem = { ...card1, id: "6", title: "Doom", releaseYear: 1993 };
    expect(buildPlacementContext([first, card2], 6)).toBe("before Portal 2 (2011)");
  });
});

// ── SoloResultControls ────────────────────────────────────────────────────────

describe("SoloResultControls", () => {
  it("renders nothing visible when show=false", () => {
    render(<SoloResultControls {...baseProps} show={false} />);
    expect(screen.queryByText("✓ Correct!")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next turn/i })).not.toBeInTheDocument();
  });

  it("renders the correct verdict banner when correct=true", () => {
    render(<SoloResultControls {...baseProps} />);
    expect(screen.getByText("✓ Correct!")).toBeInTheDocument();
  });

  it("renders the wrong placement banner when correct=false", () => {
    render(<SoloResultControls {...baseProps} correct={false} />);
    expect(screen.getByText("✗ Wrong placement")).toBeInTheDocument();
  });

  it("renders an aria-live polite region with the game name and year on correct placement", () => {
    render(<SoloResultControls {...baseProps} />);
    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion.textContent).toContain("Portal 2");
    expect(liveRegion.textContent).toContain("2011");
  });

  it("includes placement context in the live region when the card is in the timeline", () => {
    render(<SoloResultControls {...baseProps} timelineItems={[card1, card2]} />);
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toContain("after Half-Life 2");
  });

  it("live region is empty when show=false", () => {
    render(<SoloResultControls {...baseProps} show={false} />);
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("");
  });

  it("shows Next Turn button when correct", () => {
    render(<SoloResultControls {...baseProps} />);
    expect(screen.getByRole("button", { name: "Next turn" })).toBeInTheDocument();
  });

  it("shows See Result button when incorrect and not teamwork mode", () => {
    render(<SoloResultControls {...baseProps} correct={false} isTeamworkMode={false} />);
    expect(screen.getByRole("button", { name: "See game over screen" })).toBeInTheDocument();
  });
});
