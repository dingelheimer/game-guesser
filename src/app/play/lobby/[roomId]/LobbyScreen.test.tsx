import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyScreen } from "./LobbyScreen";

const mocks = vi.hoisted(() => {
  const pushMock = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const trackMock = vi.fn(async () => ({ status: "ok" }));
  const removeChannelMock = vi.fn(async () => "ok");
  const channelMock = {
    on: vi.fn(),
    presenceState: vi.fn(),
    send: vi.fn(async () => ({ status: "ok" })),
    subscribe: vi.fn(),
    track: trackMock,
  };
  const channelHandlers: Partial<Record<"join" | "leave" | "sync", () => void>> = {};
  let subscribeHandler: ((status: string) => void) | undefined;
  let presenceState: Record<string, unknown[]> = {};

  channelMock.on.mockImplementation(
    (_type: string, filter: { event?: "join" | "leave" | "sync" }, callback: () => void) => {
      if (filter.event !== undefined) {
        channelHandlers[filter.event] = callback;
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
    pushMock,
    removeChannelMock,
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
  useRouter: () => ({
    push: mocks.pushMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mocks.supabaseMock,
}));

vi.mock("@/lib/multiplayer/actions", () => ({
  leaveRoom: vi.fn(),
}));

import { leaveRoom } from "@/lib/multiplayer/actions";

const initialRoom = {
  currentUserId: "11111111-1111-4111-8111-111111111111",
  genres: [],
  hostId: "11111111-1111-4111-8111-111111111111",
  maxPlayers: 10,
  players: [
    {
      displayName: "Alex Host",
      joinedAt: "2026-04-11T22:00:00.000Z",
      role: "host",
      userId: "11111111-1111-4111-8111-111111111111",
    },
    {
      displayName: "Sam Player",
      joinedAt: "2026-04-11T22:01:00.000Z",
      role: "player",
      userId: "22222222-2222-4222-8222-222222222222",
    },
  ],
  roomCode: "ABC234",
  roomId: "33333333-3333-4333-8333-333333333333",
  settings: {
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
  },
} as const;

describe("LobbyScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setPresenceState({});
    vi.mocked(leaveRoom).mockResolvedValue({
      success: true,
      data: { roomId: initialRoom.roomId },
    });
  });

  it("tracks the current player and reconciles sync, join, and leave presence updates", async () => {
    const { unmount } = render(<LobbyScreen initialRoom={initialRoom} />);

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
    mocks.channelHandlers.sync?.();

    await waitFor(() => {
      expect(screen.getByText("1/10")).toBeInTheDocument();
      expect(screen.queryByText("Sam Player")).not.toBeInTheDocument();
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
    mocks.channelHandlers.join?.();

    await waitFor(() => {
      expect(screen.getByText("2/10")).toBeInTheDocument();
      expect(screen.getByText("Sam Player")).toBeInTheDocument();
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
    mocks.channelHandlers.leave?.();

    await waitFor(() => {
      expect(screen.getByText("1/10")).toBeInTheDocument();
      expect(screen.queryByText("Sam Player")).not.toBeInTheDocument();
    });

    unmount();

    expect(mocks.removeChannelMock).toHaveBeenCalledWith(mocks.channelMock);
  });

  it("copies the room code to the clipboard and shows a success toast", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<LobbyScreen initialRoom={initialRoom} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("ABC234");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Room code copied", {
      description: "ABC234 is ready to share.",
    });
  });

  it("leaves the room and redirects back to the play hub", async () => {
    const user = userEvent.setup();

    render(<LobbyScreen initialRoom={initialRoom} />);

    await user.click(screen.getByRole("button", { name: "Leave Room" }));

    await waitFor(() => {
      expect(leaveRoom).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333");
      expect(mocks.pushMock).toHaveBeenCalledWith("/play");
    });
  });
});
