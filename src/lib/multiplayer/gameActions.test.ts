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

import {
  proceedFromExpertVerification,
  proceedFromPlatformBonus,
  proceedFromChallenge,
  resolveTurn,
  skipTurn,
  submitChallenge,
  submitExpertVerification,
  submitPlacement,
  submitPlatformBonus,
  submitTeamVote,
} from "./gameActions";

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

describe("resolveTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("enters the platform bonus phase after a correct placement", async () => {
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
            phase: "revealing",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            placedPosition: 1,
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, winCondition: 5 },
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
            score: 5,
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
      { data: { id: sessionId }, error: null },
      { data: { id: roomId }, error: null },
    );

    const result = await resolveTurn(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.followUp).toBeUndefined();
    expect(result.data.reveal).toMatchObject({
      isCorrect: true,
      platformOptions: [{ id: 10, name: "PC" }],
      scores: {
        [activePlayerId]: 5,
        [otherPlayerId]: 3,
      },
    });
    expect(updateOperations(mocks.serviceOperations, "game_sessions")).toContainEqual({
      action: "update",
      table: "game_sessions",
      payload: expect.objectContaining({
        current_turn: expect.objectContaining({
          phase: "platform_bonus",
          platformOptions: [{ id: 10, name: "PC" }],
        }),
      }),
    });
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

  it("does not enter platform_bonus in an EXPERT game with a correct placement", async () => {
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
    const allSessionUpdates = updateOperations(mocks.serviceOperations, "game_sessions");
    expect(
      allSessionUpdates.some(
        (op) =>
          (op.payload as Record<string, unknown>)["current_turn"] !== undefined &&
          ((op.payload as Record<string, { phase?: string }>)["current_turn"] as { phase?: string })
            .phase === "platform_bonus",
      ),
    ).toBe(false);
  });

  it("routes a PRO challenge win into the platform bonus for the challenger", async () => {
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
          settings: { ...defaultSettings, variant: "pro", winCondition: 5 },
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
      scores: {
        [activePlayerId]: 4,
        [otherPlayerId]: 3,
      },
    });
    expect(updateOperations(mocks.serviceOperations, "game_sessions")).toContainEqual({
      action: "update",
      table: "game_sessions",
      payload: expect.objectContaining({
        current_turn: expect.objectContaining({
          phase: "platform_bonus",
          platformBonusPlayerId: otherPlayerId,
        }),
      }),
    });
  });
});

describe("submitChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("deducts a token and awards the card to the challenger after an incorrect placement", async () => {
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
            phaseDeadline: "2099-04-12T12:00:00.000Z",
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
          user_id: otherPlayerId,
          display_name: "Sam Player",
          score: 2,
          tokens: 2,
          turn_position: 1,
          timeline: [{ gameId: 200, releaseYear: 2001, name: "Halo" }],
        },
        error: null,
      },
      { data: null, error: null },
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
            challengerId: otherPlayerId,
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
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await submitChallenge(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.challenge).toEqual({
      challengerId: otherPlayerId,
      displayName: "Sam Player",
    });
    expect(result.data.reveal).toMatchObject({
      challengerId: otherPlayerId,
      challengeResult: "challenger_wins",
      isCorrect: false,
      scores: {
        [activePlayerId]: 4,
        [otherPlayerId]: 3,
      },
      tokens: {
        [activePlayerId]: 2,
        [otherPlayerId]: 1,
      },
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

    const gamePlayerUpdates = updateOperations(mocks.serviceOperations, "game_players");
    expect(gamePlayerUpdates).toContainEqual({
      action: "update",
      table: "game_players",
      payload: { tokens: 1 },
    });
    expect(gamePlayerUpdates).toContainEqual({
      action: "update",
      table: "game_players",
      payload: {
        score: 3,
        timeline: [
          { gameId: 103, releaseYear: 1995, name: "Portal 2" },
          { gameId: 200, releaseYear: 2001, name: "Halo" },
        ],
      },
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

  it("enters the platform bonus phase when the challenge window expires on a correct turn", async () => {
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
      platformOptions: [{ id: 10, name: "PC" }],
      scores: {
        [activePlayerId]: 5,
        [otherPlayerId]: 3,
      },
    });
    expect(result.data.followUp).toBeUndefined();
    expect(updateOperations(mocks.serviceOperations, "game_sessions")).toContainEqual({
      action: "update",
      table: "game_sessions",
      payload: expect.objectContaining({
        current_turn: expect.objectContaining({
          phase: "platform_bonus",
          platformOptions: [{ id: 10, name: "PC" }],
        }),
      }),
    });
  });
});

describe("submitPlatformBonus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("awards a capped bonus token and advances to the next turn after a correct selection", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "platform_bonus",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2099-04-12T12:00:00.000Z",
            platformOptions: [{ id: 10, name: "PC" }],
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      {
        data: {
          user_id: activePlayerId,
          display_name: "Alex Host",
          score: 5,
          tokens: 4,
          turn_position: 0,
          timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
        },
        error: null,
      },
      { data: null, error: null },
      { data: { id: sessionId }, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 5,
            tokens: 5,
            turn_position: 0,
            timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
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
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await submitPlatformBonus(sessionId, [10]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.bonus).toEqual({
      correct: true,
      correctPlatforms: [{ id: 10, name: "PC" }],
      scores: {
        [activePlayerId]: 5,
        [otherPlayerId]: 3,
      },
      timelines: {
        [activePlayerId]: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
        [otherPlayerId]: [{ gameId: 200, releaseYear: 2007, name: "Mass Effect" }],
      },
      tokenChange: 1,
      tokens: {
        [activePlayerId]: 5,
        [otherPlayerId]: 2,
      },
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
    expect(updateOperations(mocks.serviceOperations, "game_players")).toContainEqual({
      action: "update",
      table: "game_players",
      payload: { tokens: 5 },
    });
  });

  it("lets the PRO challenger answer and removes the stolen card on a wrong bonus", async () => {
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
            phase: "platform_bonus",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2099-04-12T12:00:00.000Z",
            platformBonusPlayerId: otherPlayerId,
            platformOptions: [{ id: 10, name: "PC" }],
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, variant: "pro" },
        },
        error: null,
      },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      {
        data: {
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
        error: null,
      },
      { data: null, error: null },
      { data: { id: sessionId }, error: null },
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
            score: 2,
            tokens: 1,
            turn_position: 1,
            timeline: [{ gameId: 200, releaseYear: 2001, name: "Halo" }],
          },
        ],
        error: null,
      },
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await submitPlatformBonus(sessionId, [99]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.bonus).toEqual({
      correct: false,
      correctPlatforms: [{ id: 10, name: "PC" }],
      scores: {
        [activePlayerId]: 4,
        [otherPlayerId]: 2,
      },
      timelines: {
        [activePlayerId]: [{ gameId: 100, releaseYear: 1998, name: "Half-Life" }],
        [otherPlayerId]: [{ gameId: 200, releaseYear: 2001, name: "Halo" }],
      },
      tokenChange: 0,
      tokens: {
        [activePlayerId]: 2,
        [otherPlayerId]: 1,
      },
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
    expect(updateOperations(mocks.serviceOperations, "game_players")).toContainEqual({
      action: "update",
      table: "game_players",
      payload: {
        score: 2,
        timeline: [{ gameId: 200, releaseYear: 2001, name: "Halo" }],
      },
    });
  });
});

describe("proceedFromPlatformBonus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("resolves an expired platform bonus without changing tokens", async () => {
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
            phase: "platform_bonus",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2000-04-12T12:00:00.000Z",
            platformOptions: [{ id: 10, name: "PC" }],
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: defaultSettings,
        },
        error: null,
      },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: { id: sessionId }, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 5,
            tokens: 4,
            turn_position: 0,
            timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
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
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await proceedFromPlatformBonus(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.bonus).toEqual({
      correct: false,
      correctPlatforms: [{ id: 10, name: "PC" }],
      scores: {
        [activePlayerId]: 5,
        [otherPlayerId]: 3,
      },
      timelines: {
        [activePlayerId]: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
        [otherPlayerId]: [{ gameId: 200, releaseYear: 2007, name: "Mass Effect" }],
      },
      tokenChange: 0,
      tokens: {
        [activePlayerId]: 4,
        [otherPlayerId]: 2,
      },
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
});

describe("submitExpertVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("keeps the card and advances to the next turn when both year and platforms are correct", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "expert_verification",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2099-04-12T12:00:00.000Z",
            platformBonusPlayerId: activePlayerId,
            platformOptions: [{ id: 10, name: "PC" }],
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, variant: "expert", winCondition: 10 },
        },
        error: null,
      },
      { data: { release_year: 2011 }, error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: { id: sessionId }, error: null },
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
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await submitExpertVerification(sessionId, 2011, [10]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.verification).toEqual({
      correct: true,
      correctPlatforms: [{ id: 10, name: "PC" }],
      platformsCorrect: true,
      yearCorrect: true,
      scores: {
        [activePlayerId]: 4,
        [otherPlayerId]: 3,
      },
      timelines: {
        [activePlayerId]: [
          { gameId: 100, releaseYear: 1994, name: "Super Metroid" },
          { gameId: 103, releaseYear: 2011, name: "Portal 2" },
        ],
        [otherPlayerId]: [{ gameId: 200, releaseYear: 2007, name: "Mass Effect" }],
      },
      tokens: {
        [activePlayerId]: 2,
        [otherPlayerId]: 2,
      },
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
    expect(updateOperations(mocks.serviceOperations, "game_players")).toHaveLength(0);
  });

  it("removes the card and deducts a point when the year is wrong", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "expert_verification",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2099-04-12T12:00:00.000Z",
            platformBonusPlayerId: activePlayerId,
            platformOptions: [{ id: 10, name: "PC" }],
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, variant: "expert", winCondition: 10 },
        },
        error: null,
      },
      { data: { release_year: 2011 }, error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: {
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
        error: null,
      },
      { data: null, error: null },
      { data: { id: sessionId }, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 3,
            tokens: 2,
            turn_position: 0,
            timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
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
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await submitExpertVerification(sessionId, 1999, [10]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.verification.correct).toBe(false);
    expect(result.data.verification.yearCorrect).toBe(false);
    expect(result.data.verification.platformsCorrect).toBe(true);
    expect(updateOperations(mocks.serviceOperations, "game_players")).toContainEqual({
      action: "update",
      table: "game_players",
      payload: {
        score: 3,
        timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
      },
    });
  });

  it("removes the card and deducts a point when the platforms are wrong", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103, 104],
          deck_cursor: 3,
          current_turn: {
            phase: "expert_verification",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2099-04-12T12:00:00.000Z",
            platformBonusPlayerId: activePlayerId,
            platformOptions: [{ id: 10, name: "PC" }],
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, variant: "expert", winCondition: 10 },
        },
        error: null,
      },
      { data: { release_year: 2011 }, error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: {
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
        error: null,
      },
      { data: null, error: null },
      { data: { id: sessionId }, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 3,
            tokens: 2,
            turn_position: 0,
            timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
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
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await submitExpertVerification(sessionId, 2011, [99]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.verification.correct).toBe(false);
    expect(result.data.verification.yearCorrect).toBe(true);
    expect(result.data.verification.platformsCorrect).toBe(false);
    expect(updateOperations(mocks.serviceOperations, "game_players")).toContainEqual({
      action: "update",
      table: "game_players",
      payload: {
        score: 3,
        timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
      },
    });
  });

  it("rejects an expert verification attempt from a non-designated player", async () => {
    authenticate(otherPlayerId);
    queueRegular({ data: { user_id: otherPlayerId }, error: null });
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [101, 102, 103, 104],
        deck_cursor: 3,
        current_turn: {
          phase: "expert_verification",
          activePlayerId,
          gameId: 103,
          screenshotImageId: "shot-103",
          phaseDeadline: "2099-04-12T12:00:00.000Z",
          platformBonusPlayerId: activePlayerId,
          platformOptions: [{ id: 10, name: "PC" }],
        },
        turn_number: 4,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: { ...defaultSettings, variant: "expert", winCondition: 10 },
      },
      error: null,
    });

    const result = await submitExpertVerification(sessionId, 2011, [10]);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.code).toBe("UNAUTHORIZED");
  });
});

describe("proceedFromExpertVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("resolves an expired expert verification as incorrect, removes the card and advances", async () => {
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
            phase: "expert_verification",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            phaseDeadline: "2000-04-12T12:00:00.000Z",
            platformBonusPlayerId: activePlayerId,
            platformOptions: [{ id: 10, name: "PC" }],
          },
          turn_number: 4,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, variant: "expert", winCondition: 10 },
        },
        error: null,
      },
      { data: { release_year: 2011 }, error: null },
      { data: [{ platform_id: 10 }], error: null },
      { data: [{ id: 10, name: "PC" }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: {
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
        error: null,
      },
      { data: null, error: null },
      { data: { id: sessionId }, error: null },
      {
        data: [
          {
            user_id: activePlayerId,
            display_name: "Alex Host",
            score: 3,
            tokens: 2,
            turn_position: 0,
            timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
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
      { data: [{ igdb_image_id: "shot-104" }], error: null },
      { data: { room_id: roomId }, error: null },
    );

    const result = await proceedFromExpertVerification(sessionId);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.verification).toEqual({
      correct: false,
      correctPlatforms: [{ id: 10, name: "PC" }],
      platformsCorrect: false,
      yearCorrect: false,
      scores: {
        [activePlayerId]: 3,
        [otherPlayerId]: 3,
      },
      timelines: {
        [activePlayerId]: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
        [otherPlayerId]: [{ gameId: 200, releaseYear: 2007, name: "Mass Effect" }],
      },
      tokens: {
        [activePlayerId]: 2,
        [otherPlayerId]: 2,
      },
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
    expect(updateOperations(mocks.serviceOperations, "game_players")).toContainEqual({
      action: "update",
      table: "game_players",
      payload: {
        score: 3,
        timeline: [{ gameId: 100, releaseYear: 1994, name: "Super Metroid" }],
      },
    });
  });

  it("rejects a proceed call when the deadline has not yet expired", async () => {
    authenticate(otherPlayerId);
    queueRegular(
      { data: { user_id: otherPlayerId }, error: null },
      { data: { user_id: otherPlayerId }, error: null },
    );
    queueService({
      data: {
        room_id: roomId,
        status: "active",
        deck: [101, 102, 103, 104],
        deck_cursor: 3,
        current_turn: {
          phase: "expert_verification",
          activePlayerId,
          gameId: 103,
          screenshotImageId: "shot-103",
          phaseDeadline: "2099-04-12T12:00:00.000Z",
          platformBonusPlayerId: activePlayerId,
          platformOptions: [{ id: 10, name: "PC" }],
        },
        turn_number: 4,
        turn_order: [activePlayerId, otherPlayerId],
        active_player_id: activePlayerId,
        settings: { ...defaultSettings, variant: "expert", winCondition: 10 },
      },
      error: null,
    });

    const result = await proceedFromExpertVerification(sessionId);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.code).toBe("CONFLICT");
  });
});

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

describe("submitTeamVote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.regularOperations.length = 0;
    mocks.regularResults.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.serviceResults.length = 0;
  });

  it("records a partial vote and returns vote_updated when not all players have locked in", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
    queueService(
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103],
          deck_cursor: 2,
          current_turn: {
            phase: "team_voting",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            votes: {},
          },
          turn_number: 2,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, gameMode: "teamwork" },
          team_score: 2,
          team_timeline: [{ gameId: 100, releaseYear: 1994, name: "Half-Life" }],
          team_tokens: 3,
        },
        error: null,
      },
      { data: { id: sessionId }, error: null },
    );

    // activePlayerId proposes position 0, not locked — otherPlayerId hasn't voted yet
    const result = await submitTeamVote(sessionId, 0, false, [activePlayerId, otherPlayerId]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.type).toBe("vote_updated");
    if (result.data.type !== "vote_updated") {
      return;
    }

    expect(result.data.votePayload.votes).toEqual({
      [activePlayerId]: { position: 0, locked: false },
    });
    expect(updateOperation(mocks.serviceOperations, "game_sessions").payload).toMatchObject({
      current_turn: expect.objectContaining({
        phase: "team_voting",
        votes: { [activePlayerId]: { position: 0, locked: false } },
      }),
    });
  });

  it("resolves all votes and triggers team_game_over with teamWin=true when score reaches winCondition", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
    queueService(
      // 1. loadWritableGameSession
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103],
          deck_cursor: 2,
          current_turn: {
            phase: "team_voting",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            votes: { [otherPlayerId]: { position: 1, locked: true } },
          },
          turn_number: 2,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, gameMode: "teamwork", winCondition: 5 },
          team_score: 4,
          team_timeline: [{ gameId: 100, releaseYear: 1994, name: "Half-Life" }],
          team_tokens: 3,
        },
        error: null,
      },
      // 2. Optimistic lock update (no .select/.maybeSingle)
      { data: null, error: null },
      // 3–5. loadResolvedTurnCard parallel: games, covers, game_platforms
      { data: { id: 103, name: "Portal 2", release_year: 2000 }, error: null },
      { data: { game_id: 103, igdb_image_id: "cover-103" }, error: null },
      { data: [], error: null },
      // 6. resolveTeamVote update (.select("id").maybeSingle)
      { data: { id: sessionId }, error: null },
      // 7. finishTeamworkGame session update (.select("id").maybeSingle)
      { data: { id: sessionId }, error: null },
      // 8. finishTeamworkGame room update (.select("id").maybeSingle)
      { data: { id: roomId }, error: null },
    );

    // activePlayerId locks position 1 — both players now locked → triggers resolution
    const result = await submitTeamVote(sessionId, 1, true, [activePlayerId, otherPlayerId]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.type).toBe("vote_resolved");
    if (result.data.type !== "vote_resolved") {
      return;
    }

    expect(result.data.followUp.type).toBe("team_game_over");
    if (result.data.followUp.type !== "team_game_over") {
      return;
    }

    expect(result.data.followUp.gameOver).toEqual({
      finalTeamScore: 5,
      finalTeamTimeline: expect.arrayContaining([
        expect.objectContaining({ gameId: 103, releaseYear: 2000, name: "Portal 2" }),
      ]),
      teamWin: true,
    });
    expect(result.data.resolvedPayload.correct).toBe(true);
    expect(result.data.resolvedPayload.teamScore).toBe(5);
    expect(result.data.resolvedPayload.teamTokens).toBe(3);
    expect(mocks.serviceOperations).toContainEqual({
      action: "update",
      table: "rooms",
      payload: { status: "finished" },
    });
  });

  it("resolves all votes and triggers team_game_over with teamWin=false when team tokens reach zero", async () => {
    authenticate(activePlayerId);
    queueRegular({ data: { user_id: activePlayerId }, error: null });
    queueService(
      // 1. loadWritableGameSession — 1 token remaining
      {
        data: {
          room_id: roomId,
          status: "active",
          deck: [101, 102, 103],
          deck_cursor: 2,
          current_turn: {
            phase: "team_voting",
            activePlayerId,
            gameId: 103,
            screenshotImageId: "shot-103",
            // otherPlayerId already voted wrong position
            votes: { [otherPlayerId]: { position: 0, locked: true } },
          },
          turn_number: 2,
          turn_order: [activePlayerId, otherPlayerId],
          active_player_id: activePlayerId,
          settings: { ...defaultSettings, gameMode: "teamwork", winCondition: 10 },
          team_score: 2,
          // Timeline has 1994 game — placing a 2000 game at position 0 is wrong
          team_timeline: [{ gameId: 100, releaseYear: 1994, name: "Half-Life" }],
          team_tokens: 1,
        },
        error: null,
      },
      // 2. Optimistic lock update
      { data: null, error: null },
      // 3–5. loadResolvedTurnCard: games, covers, game_platforms
      { data: { id: 103, name: "Portal 2", release_year: 2000 }, error: null },
      { data: { game_id: 103, igdb_image_id: "cover-103" }, error: null },
      { data: [], error: null },
      // 6. resolveTeamVote update
      { data: { id: sessionId }, error: null },
      // 7. finishTeamworkGame session update
      { data: { id: sessionId }, error: null },
      // 8. finishTeamworkGame room update
      { data: { id: roomId }, error: null },
    );

    // activePlayerId also locks wrong position 0 (2000-release card placed before 1994 card)
    const result = await submitTeamVote(sessionId, 0, true, [activePlayerId, otherPlayerId]);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.type).toBe("vote_resolved");
    if (result.data.type !== "vote_resolved") {
      return;
    }

    expect(result.data.followUp.type).toBe("team_game_over");
    if (result.data.followUp.type !== "team_game_over") {
      return;
    }

    expect(result.data.followUp.gameOver.teamWin).toBe(false);
    expect(result.data.resolvedPayload.correct).toBe(false);
    expect(result.data.resolvedPayload.teamTokens).toBe(0);
    expect(mocks.serviceOperations).toContainEqual({
      action: "update",
      table: "rooms",
      payload: { status: "finished" },
    });
  });
});
