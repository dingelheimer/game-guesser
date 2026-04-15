// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitScoreAction } from "./actions";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// next/navigation and next/cache are not needed by submitScoreAction but
// importing actions.ts pulls in redirect/revalidatePath from these modules.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mocks = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockGt = vi.fn(() => ({ limit: mockLimit }));
  const mockEq = vi.fn(() => ({ gt: mockGt, maybeSingle: mockMaybeSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }));
  const mockGetUser = vi.fn();

  return {
    mockInsert,
    mockMaybeSingle,
    mockLimit,
    mockGt,
    mockEq,
    mockSelect,
    mockFrom,
    mockGetUser,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mocks.mockGetUser },
    from: mocks.mockFrom,
  }),
}));

const { mockInsert, mockMaybeSingle, mockFrom, mockGetUser } = mocks;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupAuth(userId: string | null) {
  if (userId === null) {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("Not authenticated") });
  } else {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  }
}

function setupRateLimit(hasRecent: boolean) {
  mockMaybeSingle.mockResolvedValue({ data: hasRecent ? { id: 1 } : null, error: null });
}

function setupInsert(succeeds: boolean) {
  mockInsert.mockResolvedValue({ error: succeeds ? null : { message: "Insert failed" } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("submitScoreAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication check", () => {
    it("returns error when user is not authenticated", async () => {
      setupAuth(null);

      const result = await submitScoreAction(10, 5);

      expect(result).toEqual({ error: "You must be signed in to submit a score." });
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("Zod validation", () => {
    it("rejects score above 100", async () => {
      // Auth is checked before Zod in the action, but validation is first — no auth mock needed
      const result = await submitScoreAction(101, 0);
      expect(result).toEqual({ error: "Invalid score data." });
    });

    it("rejects negative score", async () => {
      const result = await submitScoreAction(-1, 0);
      expect(result).toEqual({ error: "Invalid score data." });
    });

    it("rejects negative streak", async () => {
      const result = await submitScoreAction(50, -1);
      expect(result).toEqual({ error: "Invalid score data." });
    });

    it("accepts score of 0", async () => {
      setupAuth("user-1");
      setupRateLimit(false);
      setupInsert(true);

      const result = await submitScoreAction(0, 0);
      expect(result).toEqual({ success: true });
    });

    it("accepts score of 100", async () => {
      setupAuth("user-1");
      setupRateLimit(false);
      setupInsert(true);

      const result = await submitScoreAction(100, 99);
      expect(result).toEqual({ success: true });
    });
  });

  describe("rate limiting", () => {
    it("rejects submission when last entry is within 10 seconds", async () => {
      setupAuth("user-1");
      setupRateLimit(true);

      const result = await submitScoreAction(20, 3);

      expect(result).toEqual({
        error: "Please wait a moment before submitting another score.",
      });
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("allows submission when no recent entry exists", async () => {
      setupAuth("user-1");
      setupRateLimit(false);
      setupInsert(true);

      const result = await submitScoreAction(20, 3);

      expect(result).toEqual({ success: true });
    });
  });

  describe("successful insert", () => {
    it("inserts score and streak for authenticated user", async () => {
      setupAuth("user-abc");
      setupRateLimit(false);
      setupInsert(true);

      const result = await submitScoreAction(42, 7);

      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-abc",
        score: 42,
        streak: 7,
      });
    });

    it("returns error when insert fails", async () => {
      setupAuth("user-abc");
      setupRateLimit(false);
      setupInsert(false);

      const result = await submitScoreAction(42, 7);

      expect(result).toEqual({ error: "Failed to save score. Please try again." });
    });
  });
});
