// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen";
import { initialGameFixture } from "./GameScreen.test.fixtures";

const mocks = vi.hoisted(() => {
  const sendMock = vi.fn(async () => ({ status: "ok" }));
  const proceedFromChallengeMock = vi.fn();
  const proceedFromPlatformBonusMock = vi.fn();
  const skipTurnMock = vi.fn();
  const submitChallengeMock = vi.fn();
  const submitPlacementMock = vi.fn();
  const submitPlatformBonusMock = vi.fn();
  const trackMock = vi.fn(async () => ({ status: "ok" }));
  const removeChannelMock = vi.fn(async () => "ok");
  const channelHandlers: Record<string, ((payload: { payload: unknown }) => void) | undefined> = {};
  const presenceHandlers: Partial<Record<"join" | "leave" | "sync", () => void>> = {};
  let subscribeHandler: ((status: string) => void) | undefined;
  let presenceState: Record<string, unknown[]> = {};

  const channelMock = {
    on: vi.fn(),
    presenceState: vi.fn(),
    send: sendMock,
    subscribe: vi.fn(),
    track: trackMock,
  };

  channelMock.on.mockImplementation(
    (
      type: string,
      filter: {
        event?:
          | "challenge_made"
          | "game_started"
          | "placement_made"
          | "platform_bonus_result"
          | "turn_started"
          | "turn_revealed"
          | "game_over"
          | "turn_skipped"
          | "join"
          | "leave"
          | "sync";
      },
      callback: (() => void) | ((payload: { payload: unknown }) => void),
    ) => {
      if (type === "presence" && filter.event !== undefined) {
        presenceHandlers[filter.event as "join" | "leave" | "sync"] = callback as () => void;
      }

      if (type === "broadcast" && filter.event !== undefined) {
        channelHandlers[filter.event] = callback as (payload: { payload: unknown }) => void;
      }

      return channelMock;
    },
  );

  channelMock.subscribe.mockImplementation((callback: (status: string) => void) => {
    subscribeHandler = callback;
    return channelMock;
  });

  channelMock.presenceState.mockImplementation(() => presenceState);

  const supabaseMock = {
    channel: vi.fn(() => channelMock),
    removeChannel: removeChannelMock,
  };

  return {
    channelHandlers,
    channelMock,
    presenceHandlers,
    proceedFromChallengeMock,
    proceedFromPlatformBonusMock,
    removeChannelMock,
    sendMock,
    setPresenceState(nextState: Record<string, unknown[]>) {
      presenceState = nextState;
    },
    skipTurnMock,
    submitChallengeMock,
    subscribe(status: string) {
      subscribeHandler?.(status);
    },
    submitPlacementMock,
    submitPlatformBonusMock,
    supabaseMock,
    trackMock,
  };
});

vi.mock("@/components/game/GameCard", () => ({
  GameCard: ({
    isRevealed,
    screenshotImageId,
    title,
  }: {
    isRevealed: boolean;
    screenshotImageId: string | null;
    title: string;
  }) => <div>{isRevealed ? `revealed:${title}` : `hidden:${screenshotImageId ?? "none"}`}</div>,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mocks.supabaseMock,
}));

vi.mock("@/lib/multiplayer/challengeActions", () => ({
  proceedFromChallenge: mocks.proceedFromChallengeMock,
  submitChallenge: mocks.submitChallengeMock,
  submitPlacement: mocks.submitPlacementMock,
}));

vi.mock("@/lib/multiplayer/platformBonusActions", () => ({
  proceedFromPlatformBonus: mocks.proceedFromPlatformBonusMock,
  submitPlatformBonus: mocks.submitPlatformBonusMock,
}));

vi.mock("@/lib/multiplayer/turnActions", () => ({
  skipTurn: mocks.skipTurnMock,
}));

vi.mock("@/lib/multiplayer/reconciliationAction", () => ({
  fetchReconciliationState: vi.fn(async () => null),
}));

const initialGame = initialGameFixture;

describe("GameScreen", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.setPresenceState({});
    mocks.proceedFromChallengeMock.mockReset();
    mocks.proceedFromPlatformBonusMock.mockReset();
    mocks.skipTurnMock.mockReset();
    mocks.submitChallengeMock.mockReset();
    mocks.submitPlacementMock.mockReset();
    mocks.submitPlatformBonusMock.mockReset();
  });

  it("applies revealed turn results and the final game_over payload", async () => {
    render(<GameScreen initialGame={initialGame} />);

    mocks.channelHandlers.turn_revealed?.({
      payload: {
        card: {
          gameId: 30,
          name: "Chrono Trigger",
          releaseYear: 1995,
          platform: "SNES",
          coverImageId: "cover-30",
          screenshotImageId: "shot-930",
        },
        isCorrect: true,
        position: 1,
        scores: {
          "11111111-1111-4111-8111-111111111111": 1,
          "22222222-2222-4222-8222-222222222222": 0,
        },
        tokens: {
          "11111111-1111-4111-8111-111111111111": 3,
          "22222222-2222-4222-8222-222222222222": 2,
        },
        timelines: {
          "11111111-1111-4111-8111-111111111111": [
            { gameId: 10, name: "Half-Life", releaseYear: 1998 },
            { gameId: 30, name: "Chrono Trigger", releaseYear: 1995 },
          ],
          "22222222-2222-4222-8222-222222222222": [
            { gameId: 20, name: "Portal", releaseYear: 2007 },
          ],
        },
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText("revealed:Chrono Trigger").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Score 1/7")).toBeInTheDocument();
      expect(screen.getByText("Tokens 3")).toBeInTheDocument();
    });

    mocks.channelHandlers.game_over?.({
      payload: {
        winnerId: "11111111-1111-4111-8111-111111111111",
        displayName: "Alex Host",
        finalScores: {
          "11111111-1111-4111-8111-111111111111": 7,
          "22222222-2222-4222-8222-222222222222": 4,
        },
        finalTimelines: {
          "11111111-1111-4111-8111-111111111111": [
            { gameId: 10, name: "Half-Life", releaseYear: 1998 },
          ],
          "22222222-2222-4222-8222-222222222222": [
            { gameId: 20, name: "Portal", releaseYear: 2007 },
          ],
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Final Standings")).toBeInTheDocument();
      expect(screen.getByText("Score 7/7")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /back to play/i })).toBeInTheDocument();
    });
  });

  it("renders final rankings immediately when the loaded session is already finished", () => {
    const finishedPlayers = initialGame.players.map((player, index) => ({
      ...player,
      score: index === 0 ? 4 : 7,
    }));

    render(
      <GameScreen
        initialGame={{
          ...initialGame,
          status: "finished",
          winner: {
            displayName: "Sam Player",
            userId: "22222222-2222-4222-8222-222222222222",
          },
          players: finishedPlayers,
        }}
      />,
    );

    expect(screen.getByText("Final Standings")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Sam Player wins the multiplayer match.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Final standing #1")).toBeInTheDocument();
  });
});
