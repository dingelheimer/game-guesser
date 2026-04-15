// SPDX-License-Identifier: AGPL-3.0-only
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyScreen } from "./LobbyScreen";

const mocks = vi.hoisted(() => {
  const pushMock = vi.fn();
  const toastError = vi.fn();
  const toastSuccess = vi.fn();
  const trackMock = vi.fn(async () => ({ status: "ok" }));
  const sendMock = vi.fn(async () => ({ status: "ok" }));
  const removeChannelMock = vi.fn(async () => "ok" as const);

  const presenceHandlers: Partial<Record<"join" | "leave" | "sync", () => void>> = {};
  const broadcastHandlers: Record<string, (msg: { payload: unknown }) => void> = {};
  let subscribeHandler: ((status: string) => void) | undefined;
  let presenceState: Record<string, unknown[]> = {};

  const channelMock = {
    on: vi.fn(),
    presenceState: vi.fn(),
    subscribe: vi.fn(),
    track: trackMock,
    send: sendMock,
  };

  channelMock.on.mockImplementation(
    (type: string, filter: { event?: string }, callback: (...args: unknown[]) => void) => {
      if (type === "presence" && filter.event !== undefined) {
        presenceHandlers[filter.event as "join" | "leave" | "sync"] = callback as () => void;
      } else if (type === "broadcast" && filter.event !== undefined) {
        broadcastHandlers[filter.event] = callback as (msg: { payload: unknown }) => void;
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
    broadcastHandlers,
    channelMock,
    presenceHandlers,
    pushMock,
    removeChannelMock,
    sendMock,
    setPresenceState(nextState: Record<string, unknown[]>) {
      presenceState = nextState;
    },
    subscribe(status: string) {
      subscribeHandler?.(status);
    },
    supabaseMock,
    toastError,
    toastSuccess,
    trackMock,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.pushMock }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mocks.supabaseMock,
}));

vi.mock("@/lib/multiplayer/actions", () => ({
  kickPlayer: vi.fn(),
  leaveRoom: vi.fn(),
}));

vi.mock("@/lib/multiplayer/hostActions", () => ({
  getDeckSize: vi.fn(async () => null),
  startGame: vi.fn(),
  updateSettings: vi.fn(),
}));

import { kickPlayer } from "@/lib/multiplayer/actions";
import { startGame, updateSettings } from "@/lib/multiplayer/hostActions";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const PLAYER_ID = "22222222-2222-4222-8222-222222222222";
const ROOM_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";

const baseSettings = {
  difficulty: "easy",
  turnTimer: "60",
  tokensEnabled: true,
  startingTokens: 2,
  winCondition: 10,
  gameMode: "competitive",
  variant: "standard",
  genreLockId: null,
  consoleLockFamily: null,
  decadeStart: null,
  speedRound: false,
} as const;

const hostRoom = {
  currentUserId: HOST_ID,
  genres: [],
  hostId: HOST_ID,
  maxPlayers: 10,
  players: [
    {
      displayName: "Alex Host",
      joinedAt: "2026-04-11T22:00:00.000Z",
      role: "host",
      userId: HOST_ID,
    },
    {
      displayName: "Sam Player",
      joinedAt: "2026-04-11T22:01:00.000Z",
      role: "player",
      userId: PLAYER_ID,
    },
  ],
  roomCode: "ABC234",
  roomId: ROOM_ID,
  settings: baseSettings,
} as const;

const playerRoom = {
  currentUserId: PLAYER_ID,
  genres: [],
  hostId: HOST_ID,
  maxPlayers: 10,
  players: hostRoom.players,
  roomCode: "ABC234",
  roomId: ROOM_ID,
  settings: baseSettings,
} as const;

describe("LobbyScreen — host controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setPresenceState({});
    vi.mocked(kickPlayer).mockResolvedValue({
      success: true,
      data: { roomId: ROOM_ID, targetUserId: PLAYER_ID },
    });
    vi.mocked(startGame).mockResolvedValue({
      success: true,
      data: {
        gameSessionId: SESSION_ID,
        turnOrder: [HOST_ID, PLAYER_ID],
        startingCards: {},
        firstCard: { screenshotImageId: "sc_stub" },
      },
    });
    vi.mocked(updateSettings).mockResolvedValue({
      success: true,
      data: { roomId: ROOM_ID, settings: baseSettings },
    });
  });

  it("host sees kick button next to non-host players", () => {
    render(<LobbyScreen initialRoom={hostRoom} />);

    expect(screen.getByRole("button", { name: "Kick Sam Player" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kick Alex Host" })).not.toBeInTheDocument();
  });

  it("non-host does not see kick buttons", () => {
    render(<LobbyScreen initialRoom={playerRoom} />);

    expect(screen.queryByRole("button", { name: /kick/i })).not.toBeInTheDocument();
  });

  it("kick button calls kickPlayer and broadcasts player_kicked", async () => {
    const user = userEvent.setup();
    render(<LobbyScreen initialRoom={hostRoom} />);

    await user.click(screen.getByRole("button", { name: "Kick Sam Player" }));

    await waitFor(() => {
      expect(kickPlayer).toHaveBeenCalledWith(ROOM_ID, PLAYER_ID);
    });

    expect(mocks.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "player_kicked",
        payload: { userId: PLAYER_ID },
      }),
    );
  });

  it("player_kicked broadcast redirects the kicked player to /play with a toast", async () => {
    render(<LobbyScreen initialRoom={playerRoom} />);

    act(() => {
      mocks.broadcastHandlers["player_kicked"]?.({ payload: { userId: PLAYER_ID } });
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("You were removed from the room by the host.");
      expect(mocks.pushMock).toHaveBeenCalledWith("/play");
    });
  });

  it("player_kicked broadcast with a different userId does not redirect", () => {
    render(<LobbyScreen initialRoom={playerRoom} />);

    act(() => {
      mocks.broadcastHandlers["player_kicked"]?.({ payload: { userId: HOST_ID } });
    });

    expect(mocks.pushMock).not.toHaveBeenCalled();
  });

  it("settings_updated broadcast updates the displayed settings", async () => {
    render(<LobbyScreen initialRoom={playerRoom} />);

    act(() => {
      mocks.broadcastHandlers["settings_updated"]?.({
        payload: { ...baseSettings, difficulty: "hard", winCondition: 15 },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("hard")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
    });
  });

  it("host sees Start Game button; non-host sees waiting message", () => {
    const { unmount } = render(<LobbyScreen initialRoom={hostRoom} />);
    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
    expect(screen.queryByText("Waiting for host to start...")).not.toBeInTheDocument();
    unmount();

    render(<LobbyScreen initialRoom={playerRoom} />);
    expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();
    expect(screen.getByText("Waiting for host to start...")).toBeInTheDocument();
  });

  it("Start Game is disabled when fewer than 2 players are connected", () => {
    const singlePlayerRoom = { ...hostRoom, players: [hostRoom.players[0]] } as const;
    render(<LobbyScreen initialRoom={singlePlayerRoom} />);

    expect(screen.getByRole("button", { name: /start game/i })).toBeDisabled();
  });

  it("Start Game calls startGame, broadcasts game_started, and navigates the host directly", async () => {
    const user = userEvent.setup();
    render(<LobbyScreen initialRoom={hostRoom} />);

    await user.click(screen.getByRole("button", { name: /start game/i }));

    await waitFor(() => {
      expect(startGame).toHaveBeenCalledWith(ROOM_ID);
    });

    expect(mocks.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "game_started",
        payload: expect.objectContaining({ sessionId: SESSION_ID }),
      }),
    );

    expect(mocks.pushMock).toHaveBeenCalledWith(`/play/game/${SESSION_ID}`);
  });

  it("game_started broadcast redirects all players to /play/game/[sessionId]", async () => {
    render(<LobbyScreen initialRoom={playerRoom} />);

    act(() => {
      mocks.broadcastHandlers["game_started"]?.({
        payload: {
          sessionId: SESSION_ID,
          turnOrder: [HOST_ID, PLAYER_ID],
          startingCards: {},
          firstCard: { screenshotImageId: "sc_stub" },
        },
      });
    });

    await waitFor(() => {
      expect(mocks.pushMock).toHaveBeenCalledWith(`/play/game/${SESSION_ID}`);
    });
  });

  it("host_transferred broadcast gives controls to the new host and removes them from the old host", async () => {
    const { unmount } = render(<LobbyScreen initialRoom={hostRoom} />);

    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kick Sam Player" })).toBeInTheDocument();

    act(() => {
      mocks.broadcastHandlers["host_transferred"]?.({ payload: { newHostId: PLAYER_ID } });
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();
      expect(screen.getByText("Waiting for host to start...")).toBeInTheDocument();
    });

    unmount();

    render(<LobbyScreen initialRoom={playerRoom} />);

    act(() => {
      mocks.broadcastHandlers["host_transferred"]?.({ payload: { newHostId: PLAYER_ID } });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
    });
  });
});
