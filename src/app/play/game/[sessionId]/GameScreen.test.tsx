import { act, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/lib/multiplayer/gameActions", () => ({
  proceedFromChallenge: mocks.proceedFromChallengeMock,
  proceedFromPlatformBonus: mocks.proceedFromPlatformBonusMock,
  skipTurn: mocks.skipTurnMock,
  submitChallenge: mocks.submitChallengeMock,
  submitPlacement: mocks.submitPlacementMock,
  submitPlatformBonus: mocks.submitPlatformBonusMock,
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

  it("tracks the current player presence, syncs connected counts, and cleans up the channel", async () => {
    const { unmount } = render(<GameScreen initialGame={initialGame} />);

    mocks.subscribe("SUBSCRIBED");

    await waitFor(() => {
      expect(mocks.trackMock).toHaveBeenCalledWith({
        userId: "11111111-1111-4111-8111-111111111111",
        displayName: "Alex Host",
        role: "host",
        status: "connected",
        joinedAt: "2026-04-11T22:00:00.000Z",
      });
    });

    mocks.setPresenceState({
      "11111111-1111-4111-8111-111111111111": [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          displayName: "Alex Host",
          role: "host",
          status: "connected",
          joinedAt: "2026-04-11T22:00:00.000Z",
        },
      ],
    });
    mocks.presenceHandlers.sync?.();

    await waitFor(() => {
      expect(screen.getByText("1/2 players connected")).toBeInTheDocument();
    });

    unmount();

    expect(mocks.removeChannelMock).toHaveBeenCalledWith(mocks.channelMock);
  });

  it("starts a disconnect grace period for an offline active player and skips after 30 seconds", async () => {
    vi.useFakeTimers();
    mocks.skipTurnMock.mockResolvedValue({
      success: true,
      data: {
        skipped: {
          playerId: "11111111-1111-4111-8111-111111111111",
          reason: "disconnect_timeout",
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

    await act(async () => {
      mocks.setPresenceState({
        "22222222-2222-4222-8222-222222222222": [
          {
            userId: "22222222-2222-4222-8222-222222222222",
            displayName: "Sam Player",
            role: "player",
            status: "connected",
            joinedAt: "2026-04-11T22:01:00.000Z",
          },
        ],
      });
      mocks.presenceHandlers.sync?.();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Alex Host disconnected — waiting 30s before skipping the turn.",
    );
    expect(screen.getByText("Disconnected — waiting 30s")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(mocks.skipTurnMock).toHaveBeenCalledWith(initialGame.sessionId, {
      presenceUserIds: ["22222222-2222-4222-8222-222222222222"],
      reason: "disconnect_timeout",
    });
    expect(mocks.sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "turn_skipped",
      payload: {
        playerId: "11111111-1111-4111-8111-111111111111",
        reason: "disconnect_timeout",
      },
    });
  });

  it("clears the disconnect notice when the active player reconnects before the grace window ends", async () => {
    vi.useFakeTimers();

    render(
      <GameScreen
        initialGame={{
          ...initialGame,
          currentUserId: "22222222-2222-4222-8222-222222222222",
        }}
      />,
    );

    await act(async () => {
      mocks.setPresenceState({
        "22222222-2222-4222-8222-222222222222": [
          {
            userId: "22222222-2222-4222-8222-222222222222",
            displayName: "Sam Player",
            role: "player",
            status: "connected",
            joinedAt: "2026-04-11T22:01:00.000Z",
          },
        ],
      });
      mocks.presenceHandlers.sync?.();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Alex Host disconnected");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    await act(async () => {
      mocks.setPresenceState({
        "11111111-1111-4111-8111-111111111111": [
          {
            userId: "11111111-1111-4111-8111-111111111111",
            displayName: "Alex Host",
            role: "host",
            status: "connected",
            joinedAt: "2026-04-11T22:00:00.000Z",
          },
        ],
        "22222222-2222-4222-8222-222222222222": [
          {
            userId: "22222222-2222-4222-8222-222222222222",
            displayName: "Sam Player",
            role: "player",
            status: "connected",
            joinedAt: "2026-04-11T22:01:00.000Z",
          },
        ],
      });
      mocks.presenceHandlers.sync?.();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });

    expect(mocks.skipTurnMock).not.toHaveBeenCalled();
  });

  it("updates the current turn when the game_started and turn_started broadcasts arrive", async () => {
    render(<GameScreen initialGame={initialGame} />);

    mocks.channelHandlers.game_started?.({
      payload: {
        sessionId: "44444444-4444-4444-8444-444444444444",
        turnOrder: ["22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111"],
        startingCards: {
          "11111111-1111-4111-8111-111111111111": {
            gameId: 11,
            name: "Doom",
            releaseYear: 1993,
          },
          "22222222-2222-4222-8222-222222222222": {
            gameId: 22,
            name: "Halo",
            releaseYear: 2001,
          },
        },
        firstCard: { screenshotImageId: "shot-901" },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Sam Player's turn — Placing")).toBeInTheDocument();
      expect(screen.getByText("hidden:shot-901")).toBeInTheDocument();
      expect(screen.getByText("revealed:Halo")).toBeInTheDocument();
    });

    mocks.channelHandlers.turn_started?.({
      payload: {
        activePlayerId: "11111111-1111-4111-8111-111111111111",
        screenshot: { screenshotImageId: "shot-902" },
        deadline: "2099-04-12T13:00:00.000Z",
        turnNumber: 2,
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Alex Host's turn — Placing")).toBeInTheDocument();
      expect(screen.getByText("Turn 2")).toBeInTheDocument();
      expect(screen.getAllByText("hidden:shot-902").length).toBeGreaterThanOrEqual(1);
    });
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

  it("lets the active player submit the platform bonus and broadcasts the result", async () => {
    const user = userEvent.setup();
    mocks.submitPlatformBonusMock.mockResolvedValue({
      success: true,
      data: {
        bonus: {
          correct: true,
          correctPlatforms: [{ id: 1, name: "PC" }],
          scores: {
            "11111111-1111-4111-8111-111111111111": 1,
            "22222222-2222-4222-8222-222222222222": 0,
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
          tokenChange: 1,
          tokens: {
            "11111111-1111-4111-8111-111111111111": 3,
            "22222222-2222-4222-8222-222222222222": 2,
          },
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
      },
    });

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
        platformBonusDeadline: "2099-04-12T12:00:15.000Z",
        platformOptions: [
          { id: 1, name: "PC" },
          { id: 2, name: "PS4" },
        ],
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

    await user.click(await screen.findByRole("button", { name: "PC" }));
    await user.click(screen.getByRole("button", { name: /confirm platform selection/i }));

    expect(mocks.submitPlatformBonusMock).toHaveBeenCalledWith(initialGame.sessionId, [1]);
    expect(mocks.sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "platform_bonus_result",
      payload: {
        correct: true,
        correctPlatforms: [{ id: 1, name: "PC" }],
        scores: {
          "11111111-1111-4111-8111-111111111111": 1,
          "22222222-2222-4222-8222-222222222222": 0,
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
        tokenChange: 1,
        tokens: {
          "11111111-1111-4111-8111-111111111111": 3,
          "22222222-2222-4222-8222-222222222222": 2,
        },
      },
    });
  });

  it("lets the PRO challenger answer the platform bonus after stealing the card", async () => {
    const user = userEvent.setup();
    mocks.submitPlatformBonusMock.mockResolvedValue({
      success: true,
      data: {
        bonus: {
          correct: true,
          correctPlatforms: [{ id: 1, name: "PC" }],
          scores: {
            "11111111-1111-4111-8111-111111111111": 0,
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
          tokenChange: 0,
          tokens: {
            "11111111-1111-4111-8111-111111111111": 2,
            "22222222-2222-4222-8222-222222222222": 1,
          },
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
      },
    });

    render(
      <GameScreen
        initialGame={{
          ...initialGame,
          currentUserId: "22222222-2222-4222-8222-222222222222",
          settings: { ...initialGame.settings, variant: "pro" },
        }}
      />,
    );

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
        challengerId: "22222222-2222-4222-8222-222222222222",
        challengeResult: "challenger_wins",
        isCorrect: false,
        platformBonusDeadline: "2099-04-12T12:00:15.000Z",
        platformBonusPlayerId: "22222222-2222-4222-8222-222222222222",
        platformOptions: [
          { id: 1, name: "PC" },
          { id: 2, name: "PS4" },
        ],
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
    });

    expect(await screen.findByText("PRO Required")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "PC" }));
    await user.click(screen.getByRole("button", { name: /confirm platform selection/i }));

    expect(mocks.submitPlatformBonusMock).toHaveBeenCalledWith(initialGame.sessionId, [1]);
  });
});
