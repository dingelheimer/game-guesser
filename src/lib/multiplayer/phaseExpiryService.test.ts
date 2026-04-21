// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockQueryResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

type MockOperation = {
  action: "select" | "update";
  payload?: unknown;
  table: string;
};

const mocks = vi.hoisted(() => {
  const serviceResults: MockQueryResult[] = [];
  const serviceOperations: MockOperation[] = [];
  const mockRevalidatePath = vi.fn();

  function takeResult(queue: MockQueryResult[], label: string) {
    const result = queue.shift();
    if (result === undefined) {
      throw new Error(`No queued Supabase result for ${label}.`);
    }

    return { data: result.data ?? null, error: result.error ?? null };
  }

  function createChain(result: ReturnType<typeof takeResult>) {
    const chain: Record<string, unknown> = {
      data: result.data,
      error: result.error,
    };

    for (const method of [
      "eq",
      "gte",
      "in",
      "is",
      "lte",
      "limit",
      "maybeSingle",
      "neq",
      "not",
      "order",
      "select",
      "update",
    ]) {
      chain[method] = vi.fn(() => chain);
    }

    return chain;
  }

  function createMockFrom(queue: MockQueryResult[], ops: MockOperation[]) {
    return vi.fn((table: string) => ({
      select: vi.fn(() => {
        ops.push({ action: "select", table });
        return createChain(takeResult(queue, `${table}.select`));
      }),
      update: vi.fn((payload: unknown) => {
        ops.push({ action: "update", payload, table });
        return createChain(takeResult(queue, `${table}.update`));
      }),
    }));
  }

  return {
    mockCreateServiceClient: vi.fn(() => ({
      from: createMockFrom(serviceResults, serviceOperations),
    })),
    mockRevalidatePath,
    serviceOperations,
    serviceResults,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.mockRevalidatePath,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.mockCreateServiceClient,
}));

import { scanAndAdvanceExpiredSessions } from "./phaseExpiryService";

const sessionId = "11111111-1111-4111-8111-111111111111";
const sessionId2 = "55555555-5555-4555-8555-555555555555";
const roomId = "22222222-2222-4222-8222-222222222222";
const activePlayerId = "33333333-3333-4333-8333-333333333333";
const otherPlayerId = "44444444-4444-4444-8444-444444444444";

const PAST_DEADLINE = "2000-01-01T00:00:00.000Z";

const defaultSettings = {
  difficulty: "easy",
  turnTimer: "30",
  tokensEnabled: true,
  startingTokens: 2,
  winCondition: 10,
  variant: "standard",
} as const;

function queueService(...results: readonly MockQueryResult[]) {
  mocks.serviceResults.push(...results);
}

describe("scanAndAdvanceExpiredSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("returns zeroes when there are no expired sessions", async () => {
    queueService({ data: [], error: null });

    const result = await scanAndAdvanceExpiredSessions();

    expect(result).toEqual({ processed: 0, advanced: 0, errors: 0 });
    expect(mocks.mockCreateServiceClient).toHaveBeenCalledOnce();
  });

  it("returns zeroes when no sessions have a phaseDeadline in the past", async () => {
    const futureDeadline = new Date(Date.now() + 60_000).toISOString();
    queueService({
      data: [{ id: sessionId, current_turn: { phase: "placing", phaseDeadline: futureDeadline } }],
      error: null,
    });

    const result = await scanAndAdvanceExpiredSessions();

    expect(result).toEqual({ processed: 0, advanced: 0, errors: 0 });
  });

  it("skips sessions with phases that don't need server-side expiry", async () => {
    queueService({
      data: [
        {
          id: sessionId,
          current_turn: { phase: "revealing", phaseDeadline: PAST_DEADLINE },
        },
      ],
      error: null,
    });

    const result = await scanAndAdvanceExpiredSessions();

    expect(result).toEqual({ processed: 0, advanced: 0, errors: 0 });
  });

  it("advances an expired placing phase by starting the next turn", async () => {
    // Initial scan query
    queueService({
      data: [{ id: sessionId, current_turn: { phase: "placing", phaseDeadline: PAST_DEADLINE } }],
      error: null,
    });

    // loadWritableGameSession
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [101, 102, 103],
        deck_cursor: 1,
        current_turn: {
          phase: "placing",
          activePlayerId,
          gameId: 101,
          screenshotImageId: "shot-101",
          phaseDeadline: PAST_DEADLINE,
        },
        turn_number: 2,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: defaultSettings,
      },
      error: null,
    });

    // startNextTurn: screenshots select
    queueService({ data: [{ igdb_image_id: "shot-102" }], error: null });
    // startNextTurn: game_sessions update
    queueService({ data: { room_id: roomId }, error: null });

    const result = await scanAndAdvanceExpiredSessions();

    expect(result).toEqual({ processed: 1, advanced: 1, errors: 0 });
    expect(mocks.mockRevalidatePath).toHaveBeenCalledOnce();
  });

  it("treats a CONFLICT during challenge_window advance as a non-error", async () => {
    // Initial scan query
    queueService({
      data: [
        {
          id: sessionId,
          current_turn: { phase: "challenge_window", phaseDeadline: PAST_DEADLINE },
        },
      ],
      error: null,
    });

    // loadWritableGameSession
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [101, 102, 103],
        deck_cursor: 1,
        current_turn: {
          phase: "challenge_window",
          activePlayerId,
          gameId: 101,
          screenshotImageId: "shot-101",
          phaseDeadline: PAST_DEADLINE,
        },
        turn_number: 2,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: defaultSettings,
      },
      error: null,
    });

    // advanceChallengeWindow: atomic update returns null (already advanced by client)
    queueService({ data: null, error: null });

    const result = await scanAndAdvanceExpiredSessions();

    // CONFLICT is not counted as an error — the client beat the cron
    expect(result).toEqual({ processed: 1, advanced: 0, errors: 0 });
    expect(mocks.mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("treats a phase change between scan and advance as a non-error CONFLICT", async () => {
    // Initial scan returns phase="placing"
    queueService({
      data: [{ id: sessionId, current_turn: { phase: "placing", phaseDeadline: PAST_DEADLINE } }],
      error: null,
    });

    // loadWritableGameSession returns a different phase (client advanced it)
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [101, 102, 103],
        deck_cursor: 1,
        current_turn: {
          phase: "challenge_window",
          activePlayerId,
          gameId: 101,
          screenshotImageId: "shot-101",
        },
        turn_number: 2,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: defaultSettings,
      },
      error: null,
    });

    const result = await scanAndAdvanceExpiredSessions();

    expect(result).toEqual({ processed: 1, advanced: 0, errors: 0 });
    expect(mocks.mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("counts a DB error as an error", async () => {
    // Initial scan query
    queueService({
      data: [{ id: sessionId, current_turn: { phase: "placing", phaseDeadline: PAST_DEADLINE } }],
      error: null,
    });

    // loadWritableGameSession fails
    queueService({ data: null, error: { message: "DB connection lost" } });

    const result = await scanAndAdvanceExpiredSessions();

    expect(result).toEqual({ processed: 1, advanced: 0, errors: 1 });
  });

  it("processes remaining sessions when one session fails", async () => {
    // Initial scan: two expired sessions
    queueService({
      data: [
        { id: sessionId, current_turn: { phase: "placing", phaseDeadline: PAST_DEADLINE } },
        { id: sessionId2, current_turn: { phase: "placing", phaseDeadline: PAST_DEADLINE } },
      ],
      error: null,
    });

    // Session 1: loadWritableGameSession fails
    queueService({ data: null, error: { message: "DB error" } });

    // Session 2: loadWritableGameSession succeeds
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [201, 202, 203],
        deck_cursor: 1,
        current_turn: {
          phase: "placing",
          activePlayerId,
          gameId: 201,
          screenshotImageId: "shot-201",
          phaseDeadline: PAST_DEADLINE,
        },
        turn_number: 3,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: defaultSettings,
      },
      error: null,
    });

    // Session 2: startNextTurn: screenshots select
    queueService({ data: [{ igdb_image_id: "shot-202" }], error: null });
    // Session 2: startNextTurn: game_sessions update
    queueService({ data: { room_id: roomId }, error: null });

    const result = await scanAndAdvanceExpiredSessions();

    expect(result).toEqual({ processed: 2, advanced: 1, errors: 1 });
  });
});
