// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen";
import { initialGameFixture } from "./GameScreen.test.fixtures";

const mocks = vi.hoisted(() => {
  const sendMock = vi.fn(async () => ({ status: "ok" }));
  const acceptChallengeMock = vi.fn();
  const proceedFromChallengeMock = vi.fn().mockResolvedValue({
    success: false,
    error: { code: "CONFLICT", message: "Already advanced." },
  });
  const submitChallengeMock = vi.fn();
  const submitPlacementMock = vi.fn();
  const trackMock = vi.fn(async () => ({ status: "ok" }));
  const removeChannelMock = vi.fn(async () => "ok");
  const channelHandlers: Record<string, ((payload: { payload: unknown }) => void) | undefined> = {};

  const channelMock = {
    on: vi.fn(),
    presenceState: vi.fn(() => ({})),
    send: sendMock,
    subscribe: vi.fn(),
    track: trackMock,
  };

  channelMock.on.mockImplementation(
    (
      type: string,
      filter: { event?: string },
      callback: (() => void) | ((payload: { payload: unknown }) => void),
    ) => {
      if (type === "broadcast" && filter.event !== undefined) {
        channelHandlers[filter.event] = callback as (payload: { payload: unknown }) => void;
      }
      return channelMock;
    },
  );

  channelMock.subscribe.mockImplementation((callback: (status: string) => void) => {
    callback("SUBSCRIBED");
    return channelMock;
  });

  const supabaseMock = {
    channel: vi.fn(() => channelMock),
    removeChannel: removeChannelMock,
  };

  return {
    acceptChallengeMock,
    channelHandlers,
    channelMock,
    proceedFromChallengeMock,
    removeChannelMock,
    sendMock,
    submitChallengeMock,
    submitPlacementMock,
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
  acceptChallenge: mocks.acceptChallengeMock,
  proceedFromChallenge: mocks.proceedFromChallengeMock,
  submitChallenge: mocks.submitChallengeMock,
  submitPlacement: mocks.submitPlacementMock,
}));

vi.mock("@/lib/multiplayer/platformBonusActions", () => ({
  proceedFromPlatformBonus: vi.fn(),
  submitPlatformBonus: vi.fn(),
}));

vi.mock("@/lib/multiplayer/turnActions", () => ({
  skipTurn: vi.fn(),
}));

vi.mock("@/lib/multiplayer/reconciliationAction", () => ({
  fetchReconciliationState: vi.fn(async () => null),
}));

/** Trigger the challenge_window phase via a placement_made broadcast. */
function triggerChallengeWindow() {
  mocks.channelHandlers.placement_made?.({
    payload: {
      activePlayerId: "11111111-1111-4111-8111-111111111111",
      challengeDeadline: "2099-04-12T12:00:10.000Z",
      position: 1,
    },
  });
}

const nonActiveGame = {
  ...initialGameFixture,
  currentUserId: "22222222-2222-4222-8222-222222222222",
};

describe("GameScreen — accept challenge", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.acceptChallengeMock.mockReset();
    mocks.proceedFromChallengeMock.mockReset();
    mocks.proceedFromChallengeMock.mockResolvedValue({
      success: false,
      error: { code: "CONFLICT", message: "Already advanced." },
    });
    mocks.submitChallengeMock.mockReset();
    mocks.submitPlacementMock.mockReset();
  });

  it("shows an enabled Accept Placement button to non-active players during the challenge window", async () => {
    render(<GameScreen initialGame={nonActiveGame} />);
    triggerChallengeWindow();
    expect(await screen.findByRole("button", { name: /accept placement/i })).toBeEnabled();
  });

  it("calls acceptChallenge and broadcasts challenge_accepted when the Accept button is clicked", async () => {
    const user = userEvent.setup();
    mocks.acceptChallengeMock.mockResolvedValue({ success: true, data: { allAccepted: false } });

    render(<GameScreen initialGame={nonActiveGame} />);
    triggerChallengeWindow();

    await user.click(await screen.findByRole("button", { name: /accept placement/i }));

    expect(mocks.acceptChallengeMock).toHaveBeenCalledWith(
      initialGameFixture.sessionId,
      expect.any(Array),
    );
    expect(mocks.sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "challenge_accepted",
      payload: expect.objectContaining({ userId: "22222222-2222-4222-8222-222222222222" }),
    });
  });

  it("shows Accepted ✓ (disabled) after the current user accepts", async () => {
    const user = userEvent.setup();
    mocks.acceptChallengeMock.mockResolvedValue({ success: true, data: { allAccepted: false } });

    render(<GameScreen initialGame={nonActiveGame} />);
    triggerChallengeWindow();

    await user.click(await screen.findByRole("button", { name: /accept placement/i }));

    expect(await screen.findByRole("button", { name: /accepted ✓/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /accept placement/i })).toBeNull();
  });
});
