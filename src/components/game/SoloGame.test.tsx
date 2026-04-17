// SPDX-License-Identifier: AGPL-3.0-only
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { HiddenCardData, RevealedCardData } from "@/lib/solo/api";
import type { SoloGameState } from "@/stores/soloGameStore";
import { SoloGame } from "./SoloGame";

const mockCurrentCard: HiddenCardData = {
  game_id: 42,
  screenshot_image_ids: ["shot_42"],
};

const mockRevealedCard: RevealedCardData = {
  game_id: 7,
  name: "Portal 2",
  release_year: 2011,
  cover_image_id: "cover_7",
  screenshot_image_ids: ["shot_7"],
  platform_names: ["PC"],
};

const timelineMock = vi.fn(
  ({
    pendingCard,
    highlightedCardId,
    highlightedCardTone,
  }: {
    pendingCard?: unknown;
    highlightedCardId?: string | null;
    highlightedCardTone?: "error" | null;
  }) => (
    <div
      data-has-pending={pendingCard != null ? "true" : "false"}
      data-highlighted-card-id={highlightedCardId ?? ""}
      data-highlighted-card-tone={highlightedCardTone ?? ""}
      data-testid="timeline"
    />
  ),
);

const gameCardMock = vi.fn(
  ({
    isLoading,
    isRevealed,
    platform,
  }: {
    isLoading?: boolean;
    isRevealed: boolean;
    platform: string;
  }) => (
    <div
      data-is-loading={isLoading === true ? "true" : "false"}
      data-platform={platform}
      data-is-revealed={isRevealed ? "true" : "false"}
      data-testid="hero-card"
    />
  ),
);

let mockState: SoloGameState;
const hoistedMotion = vi.hoisted(() => ({
  mockUseReducedMotion: vi.fn(() => false),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...rest
    }: {
      children?: ReactNode;
    } & HTMLAttributes<HTMLDivElement>) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReducedMotion: hoistedMotion.mockUseReducedMotion,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
  } & ButtonHTMLAttributes<HTMLButtonElement>) => <button {...rest}>{children}</button>,
}));

vi.mock("@/components/game/GameCard", () => ({
  GameCard: (props: { isLoading?: boolean; isRevealed: boolean; platform: string }) =>
    gameCardMock(props),
}));

vi.mock("@/components/game/GameOverScreen", () => ({
  GameOverScreen: () => <div data-testid="game-over-screen" />,
}));

vi.mock("@/components/game/PlatformBonusInput", () => ({
  PlatformBonusInput: () => <div data-testid="platform-bonus-input" />,
}));

vi.mock("@/components/game/ScoreBar", () => ({
  ScoreBar: () => <div data-testid="score-bar" />,
}));

vi.mock("@/components/game/Timeline", () => ({
  Timeline: (props: {
    pendingCard?: unknown;
    highlightedCardId?: string | null;
    highlightedCardTone?: "error" | null;
  }) => timelineMock(props),
}));

vi.mock("@/lib/auth/actions", () => ({
  submitScoreAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/stores/soloGameStore", () => ({
  hiddenToTimelineItem: vi.fn((card: HiddenCardData) => ({
    id: String(card.game_id),
    screenshotImageId: card.screenshot_image_ids[0] ?? null,
    coverImageId: null,
    title: "?",
    releaseYear: 0,
    platform: "?",
    isRevealed: false,
  })),
  useSoloGameStore: Object.assign(
    vi.fn((selector: (state: SoloGameState) => unknown) => selector(mockState)),
    {
      getState: vi.fn(() => ({
        startGame: vi.fn(),
      })),
    },
  ),
}));

function createState(overrides: Partial<SoloGameState> = {}): SoloGameState {
  return {
    phase: "placing",
    error: null,
    sessionId: "session-1",
    difficulty: "easy",
    variant: "standard",
    gameMode: "competitive",
    houseRules: null,
    currentCard: mockCurrentCard,
    nextCard: null,
    revealedCard: mockRevealedCard,
    timelineItems: [],
    droppedPosition: null,
    correctionTargetPosition: null,
    score: 3,
    turnsPlayed: 2,
    bestStreak: 2,
    currentStreak: 2,
    bonusPointsEarned: 1,
    bonusOpportunities: 1,
    shareOutcomes: ["correct", "correct"],
    shareYearRange: { start: 1998, end: 2007 },
    lastPlacementCorrect: null,
    validPositions: null,
    availablePlatforms: [],
    correctPlatformIds: [],
    platformBonusResult: null,
    expertVerificationResult: null,
    teamTokens: null,
    teamWinCondition: null,
    startGame: vi.fn(async () => {}),
    placeCard: vi.fn(async () => {}),
    moveCardToCorrectPosition: vi.fn(),
    revealMovedCard: vi.fn(),
    submitPlatformGuess: vi.fn(),
    submitExpertVerification: vi.fn(),
    advanceTurn: vi.fn(),
    resetGame: vi.fn(),
    ...overrides,
  };
}

describe("SoloGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    hoistedMotion.mockUseReducedMotion.mockReturnValue(false);
    mockState = createState();
  });

  it("outer container spans full width without a max-width cap", () => {
    const { container } = render(<SoloGame username={null} />);

    expect(container.firstElementChild).not.toHaveClass("max-w-7xl");
    expect(container.firstElementChild).toHaveClass("w-full");
  });

  it("card area is centred with max-w-7xl", () => {
    render(<SoloGame username={null} />);

    const cardArea = screen.getByTestId("hero-card").parentElement?.parentElement;

    expect(cardArea).toHaveClass("max-w-7xl", "mx-auto", "w-full");
  });

  it("hides the hero card on desktop during placing", () => {
    render(<SoloGame username={null} />);

    const heroWrapper = screen.getByTestId("hero-card").parentElement;

    expect(heroWrapper).toHaveClass("md:hidden");
    expect(screen.getByTestId("timeline")).toHaveAttribute("data-has-pending", "true");
  });

  it("hides the card area on desktop during placing", () => {
    render(<SoloGame username={null} />);

    const cardArea = screen.getByTestId("hero-card").parentElement?.parentElement;

    expect(cardArea).toHaveClass("md:hidden");
  });

  it("removes the hero card and pending timeline card while submitting", () => {
    mockState = createState({ phase: "submitting" });

    render(<SoloGame username={null} />);

    expect(screen.queryByTestId("hero-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("timeline")).toHaveAttribute("data-has-pending", "false");
  });

  it("shows the hero card on all screen sizes during revealing", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: true,
      currentCard: null,
    });

    render(<SoloGame username={null} />);

    const heroWrapper = screen.getByTestId("hero-card").parentElement;

    expect(heroWrapper).not.toHaveClass("md:hidden");
    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-is-revealed", "true");
    expect(screen.getByTestId("timeline")).toHaveAttribute("data-has-pending", "false");
  });

  it("shows card area on desktop during revealing", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: true,
      currentCard: null,
    });

    render(<SoloGame username={null} />);

    const cardArea = screen.getByTestId("hero-card").parentElement?.parentElement;

    expect(cardArea).not.toHaveClass("md:hidden");
    expect(cardArea).not.toHaveClass("md:flex-1", "md:justify-center");
  });

  it("anchors the timeline section to the bottom during revealing (justify-end applied)", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: true,
      currentCard: null,
    });
    render(<SoloGame username={null} />);

    const timelineSection = screen.getByTestId("timeline").parentElement;

    expect(timelineSection).toHaveClass("flex", "flex-1", "flex-col", "justify-end");
  });

  it("does not anchor the timeline section to the bottom during placing (no justify-end)", () => {
    render(<SoloGame username={null} />);

    const timelineSection = screen.getByTestId("timeline").parentElement;

    expect(timelineSection).toHaveClass("flex", "flex-1", "flex-col");
    expect(timelineSection).not.toHaveClass("justify-end");
  });

  it("keeps the hero reveal controls visible after a correct placement", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: true,
      currentCard: null,
      availablePlatforms: [
        { id: 1, name: "PC" },
        { id: 2, name: "Xbox 360" },
      ],
      correctPlatformIds: [1],
      platformBonusResult: null,
    });

    render(<SoloGame username={null} />);

    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-is-revealed", "true");
    expect(screen.getByText("✓ Correct!")).toBeInTheDocument();
    expect(screen.getByTestId("platform-bonus-input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next turn" })).toBeInTheDocument();
  });

  it("marks the platform bonus as required in PRO and disables next turn while pending", () => {
    mockState = createState({
      phase: "revealing",
      variant: "pro",
      lastPlacementCorrect: true,
      currentCard: null,
      availablePlatforms: [
        { id: 1, name: "PC" },
        { id: 2, name: "Xbox 360" },
      ],
      correctPlatformIds: [1],
      platformBonusResult: null,
    });

    render(<SoloGame username={null} />);

    expect(screen.getByText(/PRO Required:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next turn" })).toBeDisabled();
  });

  it("hides the revealed platform while the platform bonus is pending", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: true,
      currentCard: null,
      availablePlatforms: [
        { id: 1, name: "PC" },
        { id: 2, name: "Xbox 360" },
      ],
      correctPlatformIds: [1],
      platformBonusResult: null,
    });

    render(<SoloGame username={null} />);

    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-platform", "");
  });

  it("shows the revealed platform after the platform bonus is answered", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: true,
      currentCard: null,
      availablePlatforms: [
        { id: 1, name: "PC" },
        { id: 2, name: "Xbox 360" },
      ],
      correctPlatformIds: [1],
      platformBonusResult: "correct",
    });

    render(<SoloGame username={null} />);

    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-platform", "PC");
  });

  it("shows the revealed platform immediately after an incorrect placement", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: false,
      currentCard: null,
      availablePlatforms: [],
      correctPlatformIds: [],
      platformBonusResult: null,
    });

    render(<SoloGame username={null} />);

    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-platform", "PC");
  });

  it("delays wrong-placement controls until the timeline animation finishes", () => {
    vi.useFakeTimers();
    const moveCardToCorrectPosition = vi.fn();
    const revealMovedCard = vi.fn();

    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: false,
      currentCard: null,
      availablePlatforms: [],
      correctPlatformIds: [],
      platformBonusResult: null,
      moveCardToCorrectPosition,
      revealMovedCard,
    });

    render(<SoloGame username={null} />);

    expect(screen.queryByText("✗ Wrong placement")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See game over screen" })).not.toBeInTheDocument();
    expect(screen.getByTestId("timeline")).toHaveAttribute("data-highlighted-card-id", "7");
    expect(screen.getByTestId("timeline")).toHaveAttribute("data-highlighted-card-tone", "error");

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(moveCardToCorrectPosition).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(revealMovedCard).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("✗ Wrong placement")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText("✗ Wrong placement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See game over screen" })).toBeInTheDocument();
  });

  it("reveals incorrect placements instantly when reduced motion is active", () => {
    hoistedMotion.mockUseReducedMotion.mockReturnValue(true);
    const moveCardToCorrectPosition = vi.fn();
    const revealMovedCard = vi.fn();

    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: false,
      currentCard: null,
      availablePlatforms: [],
      correctPlatformIds: [],
      platformBonusResult: null,
      moveCardToCorrectPosition,
      revealMovedCard,
    });

    render(<SoloGame username={null} />);

    expect(moveCardToCorrectPosition).toHaveBeenCalledTimes(1);
    expect(revealMovedCard).toHaveBeenCalledTimes(1);
    expect(screen.getByText("✗ Wrong placement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See game over screen" })).toBeInTheDocument();
  });
});
