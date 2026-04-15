// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows a challenge button to non-active players and broadcasts the challenge result", async () => {
    const user = userEvent.setup();
    mocks.submitChallengeMock.mockResolvedValue({
      success: true,
      data: {
        challenge: {
          challengerId: "22222222-2222-4222-8222-222222222222",
          displayName: "Sam Player",
        },
        followUp: {
          type: "next_turn",
          nextTurn: {
            activePlayerId: "22222222-2222-4222-8222-222222222222",
            deadline: "2099-04-12T13:00:00.000Z",
            screenshot: { screenshotImageId: "shot-931" },
            turnNumber: 2,
          },
        },
        reveal: {
          card: {
            gameId: 30,
            name: "Chrono Trigger",
            releaseYear: 1995,
            platform: "SNES",
            coverImageId: "cover-30",
            screenshotImageId: "shot-930",
          },
          challengerId: "22222222-2222-4222-8222-222222222222",
          challengeResult: "challenger_wins",
          isCorrect: false,
          position: 1,
          scores: {
            "11111111-1111-4111-8111-111111111111": 0,
            "22222222-2222-4222-8222-222222222222": 1,
          },
          tokens: {
            "11111111-1111-4111-8111-111111111111": 2,
            "22222222-2222-4222-8222-222222222222": 1,
          },
          timelines: {
            "11111111-1111-4111-8111-111111111111": [
              { gameId: 10, name: "Half-Life", releaseYear: 1998 },
            ],
            "22222222-2222-4222-8222-222222222222": [
              { gameId: 30, name: "Chrono Trigger", releaseYear: 1995 },
              { gameId: 20, name: "Portal", releaseYear: 2007 },
            ],
          },
        },
      },
    });

    render(
      <GameScreen
        initialGame={{
          ...initialGame,
          currentUserId: "22222222-2222-4222-8222-222222222222",
        }}
      />,
    );

    mocks.channelHandlers.placement_made?.({
      payload: {
        activePlayerId: "11111111-1111-4111-8111-111111111111",
        challengeDeadline: "2099-04-12T12:00:10.000Z",
        position: 1,
      },
    });

    const challengeButton = await screen.findByRole("button", { name: /challenge \(1 token\)/i });
    expect(challengeButton).toBeEnabled();

    await user.click(challengeButton);

    expect(mocks.submitChallengeMock).toHaveBeenCalledWith(initialGame.sessionId);
    expect(mocks.sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "challenge_made",
      payload: {
        challengerId: "22222222-2222-4222-8222-222222222222",
        displayName: "Sam Player",
      },
    });
    expect(mocks.sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "turn_revealed",
      payload: expect.objectContaining({
        challengeResult: "challenger_wins",
        challengerId: "22222222-2222-4222-8222-222222222222",
      }),
    });
  });

  it("disables the challenge button when the viewer has no tokens left", async () => {
    render(
      <GameScreen
        initialGame={{
          ...initialGame,
          currentUserId: "22222222-2222-4222-8222-222222222222",
          players: initialGame.players.map((player) =>
            player.userId === "22222222-2222-4222-8222-222222222222"
              ? { ...player, tokens: 0 }
              : player,
          ),
        }}
      />,
    );

    mocks.channelHandlers.placement_made?.({
      payload: {
        activePlayerId: "11111111-1111-4111-8111-111111111111",
        challengeDeadline: "2099-04-12T12:00:10.000Z",
        position: 1,
      },
    });

    expect(await screen.findByRole("button", { name: /challenge \(1 token\)/i })).toBeDisabled();
  });

  it("lets the active player place a card and broadcasts the reveal result", async () => {
    const user = userEvent.setup();
    mocks.submitPlacementMock.mockResolvedValue({
      success: true,
      data: {
        type: "revealed",
        followUp: {
          type: "next_turn",
          nextTurn: {
            activePlayerId: "22222222-2222-4222-8222-222222222222",
            deadline: "2099-04-12T13:00:00.000Z",
            screenshot: { screenshotImageId: "shot-931" },
            turnNumber: 2,
          },
        },
        placement: {
          activePlayerId: "11111111-1111-4111-8111-111111111111",
          position: 1,
        },
        reveal: {
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
            "11111111-1111-4111-8111-111111111111": 2,
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
      },
    });

    render(<GameScreen initialGame={initialGame} />);

    await user.click(screen.getByRole("button", { name: /after Half-Life/i }));

    expect(mocks.submitPlacementMock).toHaveBeenCalledWith(initialGame.sessionId, 1);
    expect(screen.getAllByText("revealed:Chrono Trigger").length).toBeGreaterThanOrEqual(1);

    expect(mocks.sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "placement_made",
      payload: {
        activePlayerId: "11111111-1111-4111-8111-111111111111",
        position: 1,
      },
    });
    expect(mocks.sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "turn_revealed",
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
          "11111111-1111-4111-8111-111111111111": 2,
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
  });
});
