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

import { proceedFromChallenge, submitPlacement } from "./challengeActions";

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

function updateOperations(ops: MockOperation[], table: string) {
  return ops.filter(
    (entry): entry is MockOperation & { action: "update" } =>
      entry.table === table && entry.action === "update",
  );
}

describe("submitPlacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("rejects placements from non-active players", async () => {
    authenticate(otherPlayerId);
    queueRegular({ data: { user_id: otherPlayerId }, error: null });
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [101, 102, 103],
        deck_cursor: 3,
        current_turn: {
          phase: "placing",
          activePlayerId,
          gameId: 101,
          screenshotImageId: "shot-101",
          phaseDeadline: "2099-04-12T12:00:00.000Z",
        },
        turn_number: 2,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: defaultSettings,
      },
      error: null,
    });

    const result = await submitPlacement(sessionId, 1);

    expect(result).toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only the active player can place this card.",
      },
    });
    expect(mocks.serviceOperations.some((operation) => operation.action === "update")).toBe(false);
  });

  it("opens a challenge window instead of revealing immediately when tokens are enabled", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
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
            phaseDeadline: "2099-04-12T12:00:00.000Z",
          },
          turn_number: 2,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      {
        data: {
          user_id: activePlayerId,
          display_name: "Alex Host",
          score: 0,
          tokens: 2,
          turn_position: 0,
          timeline: [{ gameId: 100, releaseYear: 1998, name: "Half-Life" }],
        },
        error: null,
      },
      { data: { room_id: roomId }, error: null },
    );

    const result = await submitPlacement(sessionId, 1);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toEqual({
      placement: {
        activePlayerId,
        challengeDeadline: expect.any(String),
        position: 1,
      },
      type: "challenge_window",
    });
    expect(updateOperation(mocks.serviceOperations, "game_sessions").payload).toMatchObject({
      current_turn: expect.objectContaining({
        phase: "challenge_window",
        placedPosition: 1,
      }),
    });
  });
});

describe("proceedFromChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("skips platform bonus for Standard variant when the challenge window expires on a correct turn", async () => {
    authenticate(otherPlayerId);
    queueRegular(
      { data: { user_id: otherPlayerId }, error: null },
      { data: { user_id: otherPlayerId }, error: null },
    );
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "challenge_window",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            placedPosition: 1,
            phaseDeadline: "2000-04-12T12:00:00.000Z",
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      { data: { id: sessionId }, error: null },
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "revealing",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            placedPosition: 1,
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      {
        data: {
          user_id: activePlayerId,
          display_name: "Alex Host",
          score: 4,
          tokens: 2,
          turn_position: 0,
          timeline: [{ gameId: 100, releaseYear: 1990, name: "F-Zero" }],
        },
        error: null,
      },
      { data: { id: 103, name: "Portal 2", release_year: 1995 }, error: null },
      { data: { game_id: 103, igdb_image_id: "cover-103" }, error: null },
      { data: [{ game_id: 103, platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: null, error: null },
      { data: null, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 5,
            tokens: 2,
            turn_position: 0,
            timeline: [
              { gameId: 100, releaseYear: 1990, name: "F-Zero" },
              { gameId: 103, releaseYear: 1995, name: "Portal 2" },
            ],
          },
          {
            user_id: otherPlayerId,
            display_name: "Sam Player",
            score: 3,
            tokens: 2,
            turn_position: 1,
            timeline: [{ gameId: 200, releaseYear: 2001, name: "Halo" }],
          },
        ],
        error: null,
      },
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await proceedFromChallenge(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.reveal).toMatchObject({
      isCorrect: true,
      scores: {
        [activePlayerId]: 5,
        [otherPlayerId]: 3,
      },
    });
    expect(result.data.followUp).toBeDefined();
    expect(updateOperations(mocks.serviceOperations, "game_sessions")).not.toContainEqual({
      action: "update",
      table: "game_sessions",
      payload: expect.objectContaining({
        current_turn: expect.objectContaining({
          phase: "platform_bonus",
        }),
      }),
    });
  });
});
