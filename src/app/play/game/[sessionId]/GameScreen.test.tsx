// SPDX-License-Identifier: AGPL-3.0-only
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
});
