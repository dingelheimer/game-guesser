// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockSignInAnonymously = vi.fn();

  const mockCreateClient = vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signInAnonymously: mockSignInAnonymously,
    },
  }));

  return { mockCreateClient, mockGetUser, mockSignInAnonymously };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.mockCreateClient,
}));

import { ensureMultiplayerSession } from "./browser";

describe("ensureMultiplayerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success without creating a guest session when a user session already exists", async () => {
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const result = await ensureMultiplayerSession();

    expect(result).toEqual({ success: true, createdGuestSession: false });
    expect(mocks.mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("calls signInAnonymously and returns success when no session exists (AuthSessionMissingError)", async () => {
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });
    mocks.mockSignInAnonymously.mockResolvedValue({ error: null });

    const result = await ensureMultiplayerSession();

    expect(result).toEqual({ success: true, createdGuestSession: true });
    expect(mocks.mockSignInAnonymously).toHaveBeenCalledOnce();
  });

  it("calls signInAnonymously and returns success when getUser returns null user with no error", async () => {
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mocks.mockSignInAnonymously.mockResolvedValue({ error: null });

    const result = await ensureMultiplayerSession();

    expect(result).toEqual({ success: true, createdGuestSession: true });
    expect(mocks.mockSignInAnonymously).toHaveBeenCalledOnce();
  });

  it("returns failure with a descriptive message when signInAnonymously fails", async () => {
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });
    mocks.mockSignInAnonymously.mockResolvedValue({
      error: { message: "Anonymous sign-ins are disabled." },
    });

    const result = await ensureMultiplayerSession();

    expect(result).toEqual({
      success: false,
      message: "Couldn't start a guest session. Please try again.",
    });
  });
});
