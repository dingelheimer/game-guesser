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

import { resolveTurn } from "./turnActions";

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

function updateOperations(ops: MockOperation[], table: string) {
  return ops.filter(
    (entry): entry is MockOperation & { action: "update" } =>
      entry.table === table && entry.action === "update",
  );
}

describe("resolveTurn � expert variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("enters the expert verification phase after a correct EXPERT placement", async () => {
    authenticate(activePlayerId);
    queueRegular(
      { data: { user_id: activePlayerId }, error: null },
      { data: { user_id: activePlayerId }, error: null },
    );
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103],
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
          settings: { ...defaultSettings, variant: "expert", winCondition: 5 },
        },
        error: null,
      },
      {
        data: {
          user_id: activePlayerId,
          display_name: "Alex Host",
          score: 3,
          tokens: 2,
          turn_position: 0,
          timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
        },
        error: null,
      },
      { data: { id: 103, name: "Portal 2", release_year: 2011 }, error: null },
      { data: { game_id: 103, igdb_image_id: "cover-103" }, error: null },
      { data: [{ game_id: 103, platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: null, error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 4,
            tokens: 2,
            turn_position: 0,
            timeline: [
              { gameId: 100, releaseYear: 1994, name: "Super Metroid" },
              { gameId: 103, releaseYear: 2011, name: "Portal 2" },
            ],
          },
          {
            user_id: otherPlayerId,
            display_name: "Sam Player",
            score: 3,
            tokens: 2,
            turn_position: 1,
            timeline: [{ gameId: 200, releaseYear: 2007, name: "Mass Effect" }],
          },
        ],
        error: null,
      },
    );

    const result = await resolveTurn(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.followUp).toBeUndefined();
    expect(result.data.reveal).toMatchObject({
      isCorrect: true,
      platformBonusPlayerId: activePlayerId,
      platformOptions: [{ id: 10, name: "PC" }],
      expertVerificationDeadline: expect.any(String),
    });
    expect(updateOperations(mocks.serviceOperations, "game_sessions")).toContainEqual({
      action: "update",
      table: "game_sessions",
      payload: expect.objectContaining({
        current_turn: expect.objectContaining({
          phase: "expert_verification",
          platformBonusPlayerId: activePlayerId,
        }),
      }),
    });
  });

  it("routes an EXPERT challenge win into expert verification for the challenger", async () => {
    authenticate(activePlayerId);
    queueRegular(
      { data: { user_id: activePlayerId }, error: null },
      { data: { user_id: activePlayerId }, error: null },
    );
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103],
          deck_cursor: 3,
          current_turn: {
            phase: "revealing",
            activePlayerId,
            challengerId: otherPlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            placedPosition: 1,
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, variant: "expert", winCondition: 5 },
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
          timeline: [{ gameId: 100, releaseYear: 1998, name: "Half-Life" }],
        },
        error: null,
      },
      { data: { id: 103, name: "Portal 2", release_year: 1995 }, error: null },
      { data: { game_id: 103, igdb_image_id: "cover-103" }, error: null },
      { data: [{ game_id: 103, platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      {
        data: {
          user_id: otherPlayerId,
          display_name: "Sam Player",
          score: 2,
          tokens: 1,
          turn_position: 1,
          timeline: [{ gameId: 200, releaseYear: 2001, name: "Halo" }],
        },
        error: null,
      },
      { data: null, error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 4,
            tokens: 2,
            turn_position: 0,
            timeline: [{ gameId: 100, releaseYear: 1998, name: "Half-Life" }],
          },
          {
            user_id: otherPlayerId,
            display_name: "Sam Player",
            score: 3,
            tokens: 1,
            turn_position: 1,
            timeline: [
              { gameId: 103, releaseYear: 1995, name: "Portal 2" },
              { gameId: 200, releaseYear: 2001, name: "Halo" },
            ],
          },
        ],
        error: null,
      },
    );

    const result = await resolveTurn(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.followUp).toBeUndefined();
    expect(result.data.reveal).toMatchObject({
      challengerId: otherPlayerId,
      challengeResult: "challenger_wins",
      isCorrect: false,
      platformBonusPlayerId: otherPlayerId,
      platformOptions: [{ id: 10, name: "PC" }],
      expertVerificationDeadline: expect.any(String),
    });
    expect(updateOperations(mocks.serviceOperations, "game_sessions")).toContainEqual({
      action: "update",
      table: "game_sessions",
      payload: expect.objectContaining({
        current_turn: expect.objectContaining({
          phase: "expert_verification",
          platformBonusPlayerId: otherPlayerId,
        }),
      }),
    });
  });
});
