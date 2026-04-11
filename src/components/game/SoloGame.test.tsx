import { render, screen } from "@testing-library/react";
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

const timelineMock = vi.fn(({ pendingCard }: { pendingCard?: unknown }) => (
  <div data-has-pending={pendingCard != null ? "true" : "false"} data-testid="timeline" />
));

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
  useReducedMotion: vi.fn(() => false),
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
  Timeline: (props: { pendingCard?: unknown }) => timelineMock(props),
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
    currentCard: mockCurrentCard,
    nextCard: null,
    revealedCard: mockRevealedCard,
    timelineItems: [],
    score: 3,
    turnsPlayed: 2,
    bestStreak: 2,
    currentStreak: 2,
    bonusPointsEarned: 1,
    bonusOpportunities: 1,
    lastPlacementCorrect: null,
    validPositions: null,
    availablePlatforms: [],
    correctPlatformIds: [],
    platformBonusResult: null,
    startGame: vi.fn(async () => {}),
    placeCard: vi.fn(async () => {}),
    submitPlatformGuess: vi.fn(),
    advanceTurn: vi.fn(),
    resetGame: vi.fn(),
    ...overrides,
  };
}

describe("SoloGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = createState();
  });

  it("uses the wider story 6.3 layout container", () => {
    const { container } = render(<SoloGame />);

    expect(container.firstElementChild).toHaveClass("max-w-7xl");
  });

  it("hides the hero card on desktop during placing", () => {
    render(<SoloGame />);

    const heroWrapper = screen.getByTestId("hero-card").parentElement;

    expect(heroWrapper).toHaveClass("md:hidden");
    expect(screen.getByTestId("timeline")).toHaveAttribute("data-has-pending", "true");
  });

  it("keeps the hero card hidden on desktop while submitting", () => {
    mockState = createState({ phase: "submitting" });

    render(<SoloGame />);

    const heroWrapper = screen.getByTestId("hero-card").parentElement;

    expect(heroWrapper).toHaveClass("md:hidden");
    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-is-loading", "true");
  });

  it("shows the hero card on all screen sizes during revealing", () => {
    mockState = createState({
      phase: "revealing",
      lastPlacementCorrect: true,
      currentCard: null,
    });

    render(<SoloGame />);

    const heroWrapper = screen.getByTestId("hero-card").parentElement;

    expect(heroWrapper).not.toHaveClass("md:hidden");
    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-is-revealed", "true");
    expect(screen.getByTestId("timeline")).toHaveAttribute("data-has-pending", "false");
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

    render(<SoloGame />);

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

    render(<SoloGame />);

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

    render(<SoloGame />);

    expect(screen.getByTestId("hero-card")).toHaveAttribute("data-platform", "PC");
  });
});
