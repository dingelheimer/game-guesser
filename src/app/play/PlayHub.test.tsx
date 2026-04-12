import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayHub } from "./PlayHub";
import { ensureMultiplayerSession } from "@/lib/multiplayer/browser";
import { createRoom, joinRoom } from "@/lib/multiplayer/actions";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/multiplayer/browser", () => ({
  ensureMultiplayerSession: vi.fn(),
}));

vi.mock("@/lib/multiplayer/actions", () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

describe("PlayHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(ensureMultiplayerSession).mockResolvedValue({
      success: true,
      createdGuestSession: false,
    });
    vi.mocked(createRoom).mockResolvedValue({
      success: true,
      data: {
        roomCode: "ABC234",
        roomId: "room-123",
      },
    });
    vi.mocked(joinRoom).mockResolvedValue({
      success: true,
      data: {
        roomId: "room-456",
      },
    });
  });

  it("keeps solo play available and prefills the create-room display name", async () => {
    const user = userEvent.setup();

    render(<PlayHub defaultDisplayName="Alex" />);

    expect(screen.getByRole("link", { name: "Solo Endless" })).toHaveAttribute(
      "href",
      "/play/solo",
    );

    await user.click(screen.getByRole("button", { name: "Create Room" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Display name")).toHaveValue("Alex");
  });

  it("starts guest auth before creating a room and redirects to the lobby", async () => {
    const user = userEvent.setup();

    vi.mocked(ensureMultiplayerSession).mockResolvedValue({
      success: true,
      createdGuestSession: true,
    });

    render(<PlayHub defaultDisplayName={null} />);

    await user.click(screen.getByRole("button", { name: "Create Room" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Display name"), "Guest One");
    await user.click(within(dialog).getByRole("button", { name: "Create Room" }));

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith("Guest One");
    });

    expect(ensureMultiplayerSession).toHaveBeenCalledTimes(1);
    const authCallOrder = vi.mocked(ensureMultiplayerSession).mock.invocationCallOrder[0];
    const createCallOrder = vi.mocked(createRoom).mock.invocationCallOrder[0];

    expect(authCallOrder).toBeDefined();
    expect(createCallOrder).toBeDefined();

    if (authCallOrder === undefined || createCallOrder === undefined) {
      throw new Error("Expected guest auth and room creation to run.");
    }

    expect(authCallOrder).toBeLessThan(createCallOrder);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/play/lobby/room-123");
    });
  });

  it("uppercases and sanitizes room codes while focusing the join input", async () => {
    const user = userEvent.setup();

    render(<PlayHub defaultDisplayName="Alex" />);

    await user.click(screen.getByRole("button", { name: "Join Room" }));

    const dialog = screen.getByRole("dialog");
    const roomCodeInput = within(dialog).getByLabelText("Room code");

    await waitFor(() => {
      expect(roomCodeInput).toHaveFocus();
    });

    await user.type(roomCodeInput, "ab1o23?cd");

    expect(roomCodeInput).toHaveValue("AB23CD");
  });

  it("shows inline join errors from the server action", async () => {
    const user = userEvent.setup();

    vi.mocked(joinRoom).mockResolvedValue({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "That room code does not match an open lobby.",
      },
    });

    render(<PlayHub defaultDisplayName="Alex" />);

    await user.click(screen.getByRole("button", { name: "Join Room" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Room code"), "abc234");
    await user.clear(within(dialog).getByLabelText("Display name"));
    await user.type(within(dialog).getByLabelText("Display name"), "Alex");
    await user.click(within(dialog).getByRole("button", { name: "Join Room" }));

    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "That room code does not match an open lobby.",
      );
    });
  });
});
