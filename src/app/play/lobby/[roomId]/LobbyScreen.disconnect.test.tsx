import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyScreen } from "./LobbyScreen";

const mocks = vi.hoisted(() => {
  const pushMock = vi.fn();
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
  let presenceState: Record<string, unknown[]> = {};

  channelMock.on.mockImplementation(
    (_type: string, filter: { event?: string }, callback: () => void) => {
      if (filter.event === "join" || filter.event === "leave" || filter.event === "sync") {
        channelHandlers[filter.event] = callback;
      }

      return channelMock;
    },
  );
  channelMock.subscribe.mockImplementation((callback: (status: string) => void) => {
    callback("SUBSCRIBED");
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
    supabaseMock,
    toastError,
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
    success: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mocks.supabaseMock,
}));

vi.mock("@/lib/multiplayer/actions", () => ({
  kickPlayer: vi.fn(),
  leaveRoom: vi.fn(),
}));

vi.mock("@/lib/multiplayer/hostActions", () => ({
  claimHost: vi.fn(),
  startGame: vi.fn(),
  updateSettings: vi.fn(),
}));

import { claimHost } from "@/lib/multiplayer/hostActions";

/** Two-player lobby where the current user is NOT the host. */
const nonHostRoom = {
  currentUserId: "22222222-2222-4222-8222-222222222222",
  hostId: "11111111-1111-1111-8111-111111111111",
  maxPlayers: 10,
  players: [
    {
      displayName: "Alice Host",
      joinedAt: "2026-04-12T09:00:00.000Z",
      role: "host" as const,
      userId: "11111111-1111-1111-8111-111111111111",
    },
    {
      displayName: "Bob Player",
      joinedAt: "2026-04-12T09:01:00.000Z",
      role: "player" as const,
      userId: "22222222-2222-4222-8222-222222222222",
    },
  ],
  roomCode: "XKQ234",
  roomId: "33333333-3333-4333-8333-333333333333",
  settings: {
    difficulty: "easy" as const,
    turnTimer: "60" as const,
    tokensEnabled: true,
    startingTokens: 2,
    winCondition: 10,
    variant: "standard" as const,
  },
} as const;

function setHostPresence() {
  mocks.setPresenceState({
    "11111111-1111-1111-8111-111111111111": [
      {
        userId: "11111111-1111-1111-8111-111111111111",
        displayName: "Alice Host",
        role: "host",
        status: "connected",
        joinedAt: "2026-04-12T09:00:00.000Z",
      },
    ],
    "22222222-2222-4222-8222-222222222222": [
      {
        userId: "22222222-2222-4222-8222-222222222222",
        displayName: "Bob Player",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T09:01:00.000Z",
      },
    ],
  });
}

function setNoHostPresence() {
  mocks.setPresenceState({
    "22222222-2222-4222-8222-222222222222": [
      {
        userId: "22222222-2222-4222-8222-222222222222",
        displayName: "Bob Player",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T09:01:00.000Z",
      },
    ],
  });
}

describe("LobbyScreen — disconnect handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setPresenceState({});
    // Only fake setInterval/clearInterval — leaving setTimeout real so that
    // waitFor's internal polling (which uses setTimeout) is not blocked.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the countdown banner when the host leaves presence", async () => {
    render(<LobbyScreen initialRoom={nonHostRoom} />);

    // Host and player are both online
    setHostPresence();
    act(() => {
      mocks.channelHandlers.sync?.();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Host leaves
    setNoHostPresence();
    act(() => {
      mocks.channelHandlers.leave?.();
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Host disconnected — transferring in \d+s/,
      );
    });
  });

  it("cancels the countdown when the host reconnects", async () => {
    render(<LobbyScreen initialRoom={nonHostRoom} />);

    // Host starts online
    setHostPresence();
    act(() => {
      mocks.channelHandlers.sync?.();
    });

    // Host disconnects
    setNoHostPresence();
    act(() => {
      mocks.channelHandlers.leave?.();
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Host disconnected/);
    });

    // Host reconnects within grace period
    setHostPresence();
    act(() => {
      mocks.channelHandlers.join?.();
    });

    await waitFor(() => {
      expect(screen.queryByText(/Host disconnected/)).not.toBeInTheDocument();
    });
  });

  it("calls claimHost when the countdown expires", async () => {
    vi.mocked(claimHost).mockResolvedValue({
      success: true,
      data: { newHostId: "44444444-4444-4444-8444-444444444444" },
    });

    render(<LobbyScreen initialRoom={nonHostRoom} />);

    setHostPresence();
    act(() => {
      mocks.channelHandlers.sync?.();
    });

    // Host disconnects — starts countdown
    setNoHostPresence();
    act(() => {
      mocks.channelHandlers.leave?.();
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Host disconnected/);
    });

    // Advance timer past the grace period
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(claimHost).toHaveBeenCalledWith(
        nonHostRoom.roomId,
        expect.arrayContaining([nonHostRoom.currentUserId]),
      );
    });
  });

  it("broadcasts host_transferred and updates hostId on successful claim", async () => {
    const newHostId = "44444444-4444-4444-8444-444444444444";
    vi.mocked(claimHost).mockResolvedValue({
      success: true,
      data: { newHostId },
    });

    render(<LobbyScreen initialRoom={nonHostRoom} />);

    setHostPresence();
    act(() => {
      mocks.channelHandlers.sync?.();
    });

    setNoHostPresence();
    act(() => {
      mocks.channelHandlers.leave?.();
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(mocks.channelMock.send).toHaveBeenCalledWith({
        type: "broadcast",
        event: "host_transferred",
        payload: { newHostId },
      });
    });
  });

  it("silently ignores a CONFLICT error from claimHost (race condition)", async () => {
    vi.mocked(claimHost).mockResolvedValue({
      success: false,
      error: { code: "CONFLICT", message: "Host was already transferred." },
    });

    render(<LobbyScreen initialRoom={nonHostRoom} />);

    setHostPresence();
    act(() => {
      mocks.channelHandlers.sync?.();
    });

    setNoHostPresence();
    act(() => {
      mocks.channelHandlers.leave?.();
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(claimHost).toHaveBeenCalled();
    });

    // No error message shown
    expect(screen.queryByText("Host was already transferred.")).not.toBeInTheDocument();
  });

  it("shows an error message for non-CONFLICT claimHost failures", async () => {
    vi.mocked(claimHost).mockResolvedValue({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to transfer host. Please try again." },
    });

    render(<LobbyScreen initialRoom={nonHostRoom} />);

    setHostPresence();
    act(() => {
      mocks.channelHandlers.sync?.();
    });

    setNoHostPresence();
    act(() => {
      mocks.channelHandlers.leave?.();
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to transfer host. Please try again.")).toBeInTheDocument();
    });
  });

  it("does not show the countdown when the current user is the host", async () => {
    /** Host room where current user IS the host. */
    const hostRoom = {
      ...nonHostRoom,
      currentUserId: "11111111-1111-1111-8111-111111111111",
    } as const;

    render(<LobbyScreen initialRoom={hostRoom} />);

    // Presence shows only the non-host player (host is "offline" from their own perspective)
    setNoHostPresence();
    act(() => {
      mocks.channelHandlers.sync?.();
    });

    // No countdown should appear for the host
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryByText(/Host disconnected/)).not.toBeInTheDocument();
  });
});
