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
  const regularResults: MockQueryResult[] = [];
  const serviceResults: MockQueryResult[] = [];
  const regularOperations: MockOperation[] = [];
  const serviceOperations: MockOperation[] = [];
  const mockGetUser = vi.fn();
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
    mockCreateClient: vi.fn(async () => ({
      auth: { getUser: mockGetUser },
      from: createMockFrom(regularResults, regularOperations),
    })),
    mockCreateServiceClient: vi.fn(() => ({
      from: createMockFrom(serviceResults, serviceOperations),
    })),
    mockGetUser,
    mockRevalidatePath,
    regularOperations,
    regularResults,
    serviceOperations,
    serviceResults,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.mockRevalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.mockCreateClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.mockCreateServiceClient,
}));

import { skipTurn } from "./turnActions";

const sessionId = "11111111-1111-4111-8111-111111111111";
const roomId = "22222222-2222-4222-8222-222222222222";
const activePlayerId = "33333333-3333-4333-8333-333333333333";
const otherPlayerId = "44444444-4444-4444-8444-444444444444";

const defaultSettings = {
  difficulty: "easy",
  turnTimer: "30",
  tokensEnabled: true,
  startingTokens: 2,
  winCondition: 10,
  variant: "standard",
} as const;

function authenticate(userId = activePlayerId) {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function queueRegular(...results: readonly MockQueryResult[]) {
  mocks.regularResults.push(...results);
}

function queueService(...results: readonly MockQueryResult[]) {
  mocks.serviceResults.push(...results);
}

function updateOperation(ops: MockOperation[], table: string) {
  const found = ops.find(
    (entry): entry is MockOperation & { action: "update" } =>
      entry.table === table && entry.action === "update",
  );
  if (found === undefined) {
    throw new Error(`Expected an update operation for ${table}.`);
  }

  return found;
}

describe("skipTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("advances to the next player after a turn timer expires", async () => {
    authenticate(otherPlayerId);
    queueRegular({ data: { user_id: otherPlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "placing",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2000-04-12T12:00:00.000Z",
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await skipTurn(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.skipped).toEqual({
      playerId: activePlayerId,
      reason: "turn_timer_expired",
    });
    expect(result.data.followUp).toEqual({
      type: "next_turn",
      nextTurn: {
        activePlayerId: otherPlayerId,
        deadline: expect.any(String),
        screenshot: { screenshotImageId: "shot-104" },
        turnNumber: 5,
      },
    });

    expect(updateOperation(mocks.serviceOperations, "game_sessions").payload).toMatchObject({
      active_player_id: otherPlayerId,
      deck_cursor: 4,
      turn_number: 5,
    });
  });

  it("allows a disconnected active player to be skipped before the turn timer expires", async () => {
    authenticate(otherPlayerId);
    queueRegular({ data: { user_id: otherPlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "placing",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2099-04-12T12:00:00.000Z",
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await skipTurn(sessionId, {
      presenceUserIds: [otherPlayerId],
      reason: "disconnect_timeout",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.skipped).toEqual({
      playerId: activePlayerId,
      reason: "disconnect_timeout",
    });
    expect(result.data.followUp).toEqual({
      type: "next_turn",
      nextTurn: {
        activePlayerId: otherPlayerId,
        deadline: expect.any(String),
        screenshot: { screenshotImageId: "shot-104" },
        turnNumber: 5,
      },
    });
  });

  it("rejects a disconnect skip once the active player is back in presence", async () => {
    authenticate(otherPlayerId);
    queueRegular({ data: { user_id: otherPlayerId }, error: null });
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [101, 102, 103, 104],
        deck_cursor: 3,
        current_turn: {
          phase: "placing",
          activePlayerId,
          gameId: 103,
          screenshotImageId: "shot-103",
          phaseDeadline: "2099-04-12T12:00:00.000Z",
        },
        turn_number: 4,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: defaultSettings,
      },
      error: null,
    });

    const result = await skipTurn(sessionId, {
      presenceUserIds: [activePlayerId, otherPlayerId],
      reason: "disconnect_timeout",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "The active player reconnected before the disconnect grace period expired.",
      },
    });
    expect(mocks.serviceOperations.some((operation) => operation.action === "update")).toBe(false);
  });

  it("finishes the game on deck exhaustion using turn order as the tie-breaker", async () => {
    authenticate(otherPlayerId);
    queueRegular({ data: { user_id: otherPlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103],
          deck_cursor: 3,
          current_turn: {
            phase: "placing",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2000-04-12T12:00:00.000Z",
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 6,
            tokens: 2,
            turn_position: 0,
            timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
          },
          {
            user_id: otherPlayerId,
            display_name: "Sam Player",
            score: 6,
            tokens: 3,
            turn_position: 1,
            timeline: [{ gameId: 200, releaseYear: 2007, name: "Mass Effect" }],
          },
        ],
        error: null,
      },
      { data: { id: sessionId }, error: null },
      { data: { id: roomId }, error: null },
    );

    const result = await skipTurn(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.followUp).toEqual({
      type: "game_over",
      gameOver: {
        winnerId: activePlayerId,
        displayName: "Alex Host",
        finalScores: {
          [activePlayerId]: 6,
          [otherPlayerId]: 6,
        },
        finalTimelines: {
          [activePlayerId]: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
          [otherPlayerId]: [{ gameId: 200, releaseYear: 2007, name: "Mass Effect" }],
        },
      },
    });
    expect(mocks.serviceOperations).toContainEqual({
      action: "update",
      table: "rooms",
      payload: { status: "finished" },
    });
  });
});
