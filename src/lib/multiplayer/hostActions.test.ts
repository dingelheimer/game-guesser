import type * as DeckModule from "./deck";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockQueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

type MockOperation = {
  action: "insert" | "select" | "update" | "rpc";
  columns?: string;
  options?: unknown;
  payload?: unknown;
  table?: string;
  fn?: string;
  args?: unknown;
};

const mocks = vi.hoisted(() => {
  const queryResults: MockQueryResult[] = [];
  const operations: MockOperation[] = [];
  const serviceOperations: MockOperation[] = [];
  const mockGetUser = vi.fn();
  const mockRevalidatePath = vi.fn();
  const mockBuildDeck = vi.fn();

  function takeResult(label: string) {
    const result = queryResults.shift();
    if (result === undefined) {
      throw new Error(`No queued Supabase result for query: ${label}`);
    }
    return { count: result.count ?? null, data: result.data ?? null, error: result.error ?? null };
  }

  function createChain(result: ReturnType<typeof takeResult>) {
    const chain: Record<string, unknown> = {
      count: result.count,
      data: result.data,
      error: result.error,
    };
    // All chaining methods return the same chain (no new result consumed).
    for (const method of [
      "eq",
      "neq",
      "in",
      "order",
      "limit",
      "maybeSingle",
      "single",
      "select",
      "update",
    ]) {
      chain[method] = vi.fn(() => chain);
    }
    return chain;
  }

  function createMockFrom(ops: MockOperation[]) {
    return vi.fn((table: string) => ({
      select: vi.fn((columns?: string, options?: unknown) => {
        ops.push({
          action: "select",
          table,
          ...(columns !== undefined && { columns }),
          ...(options !== undefined && { options }),
        });
        return createChain(takeResult(`${table}.select`));
      }),
      update: vi.fn((payload: unknown) => {
        ops.push({ action: "update", table, payload });
        return createChain(takeResult(`${table}.update`));
      }),
      insert: vi.fn((payload: unknown) => {
        ops.push({ action: "insert", table, payload });
        return createChain(takeResult(`${table}.insert`));
      }),
    }));
  }

  const mockFrom = createMockFrom(operations);
  const mockServiceFrom = createMockFrom(serviceOperations);

  const mockRpc = vi.fn((fn: string, args?: unknown) => {
    operations.push({ action: "rpc", fn, ...(args !== undefined && { args }) });
    return takeResult(`rpc.${fn}`);
  });

  const mockCreateClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }));

  const mockCreateServiceClient = vi.fn(() => ({
    from: mockServiceFrom,
  }));

  return {
    mockBuildDeck,
    mockCreateClient,
    mockCreateServiceClient,
    mockGetUser,
    mockRevalidatePath,
    operations,
    serviceOperations,
    queryResults,
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

vi.mock("./deck", async () => {
  const actual = await vi.importActual<typeof DeckModule>("./deck");
  return {
    ...actual,
    buildDeck: mocks.mockBuildDeck,
    // No-op shuffle so turn order is deterministic in tests.
    fisherYatesShuffle: <T>(arr: T[]): T[] => arr,
  };
});

import { updateSettings, startGame, claimHost } from "./hostActions";

function queueResults(...results: readonly MockQueryResult[]) {
  mocks.queryResults.push(...results);
}

function authenticate(userId = "user-1") {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function updateOperation(ops: MockOperation[], table: string, index = 0) {
  const found = ops.filter(
    (entry): entry is MockOperation & { action: "update" } =>
      entry.table === table && entry.action === "update",
  )[index];
  if (found === undefined) throw new Error(`Expected an update operation for ${table}.`);
  return found;
}

function insertOperation(ops: MockOperation[], table: string, index = 0) {
  const found = ops.filter(
    (entry): entry is MockOperation & { action: "insert" } =>
      entry.table === table && entry.action === "insert",
  )[index];
  if (found === undefined) throw new Error(`Expected an insert operation for ${table}.`);
  return found;
}

// ── updateSettings ────────────────────────────────────────────────────────────

describe("updateSettings", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.queryResults.length = 0;
  });

  it("lets the host update room settings", async () => {
    authenticate(hostId);
    const settings = {
      difficulty: "hard",
      turnTimer: "30",
      tokensEnabled: false,
      startingTokens: 0,
      winCondition: 15,
      gameMode: "competitive",
      variant: "expert",
      genreLockId: null,
      consoleLockFamily: null,
      decadeStart: null,
      speedRound: false,
    } as const;

    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { error: null },
    );

    const result = await updateSettings(roomId, settings);

    expect(result).toEqual({ success: true, data: { roomId, settings } });
    expect(updateOperation(mocks.operations, "rooms").payload).toEqual({ settings });
  });

  it("rejects settings updates from non-host players", async () => {
    authenticate("33333333-3333-4333-8333-333333333333");

    queueResults({ data: { host_id: hostId, status: "lobby", settings: null }, error: null });

    const result = await updateSettings(roomId, {
      difficulty: "medium",
      turnTimer: "60",
      tokensEnabled: true,
      startingTokens: 2,
      winCondition: 10,
      gameMode: "competitive",
      variant: "standard",
      genreLockId: null,
      consoleLockFamily: null,
      decadeStart: null,
      speedRound: false,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Only the host can update room settings." },
    });
    expect(mocks.operations.some((op) => op.action === "update")).toBe(false);
  });
});

// ── startGame ─────────────────────────────────────────────────────────────────

describe("startGame", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";
  const player1 = "33333333-3333-4333-8333-333333333333";
  const player2 = "44444444-4444-4444-8444-444444444444";
  const gameSessionId = "55555555-5555-4555-8555-555555555555";

  const defaultSettings = {
    difficulty: "easy",
    turnTimer: "60",
    tokensEnabled: true,
    startingTokens: 2,
    winCondition: 10,
    gameMode: "competitive",
    variant: "standard",
    genreLockId: null,
    consoleLockFamily: null,
    decadeStart: null,
    speedRound: false,
  };

  const deck = [101, 102, 103, 104, 105];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.queryResults.length = 0;
    mocks.mockBuildDeck.mockResolvedValue(deck);
  });

  function queueFullSuccess(settings = defaultSettings) {
    queueResults(
      // 1. rooms select (getRoomState)
      { data: { host_id: hostId, status: "lobby", settings }, error: null },
      // 2. room_players count (getRoomPlayerCount)
      { count: 2, error: null },
      // 3. room_players select (fetch players)
      {
        data: [
          { user_id: player1, display_name: "Alice" },
          { user_id: player2, display_name: "Bob" },
        ],
        error: null,
      },
      // 4. games select (service client — starting cards + first turn)
      {
        data: [
          { id: 101, name: "Game A", release_year: 2000 },
          { id: 102, name: "Game B", release_year: 2010 },
          { id: 103, name: "Game C", release_year: 2015 },
        ],
        error: null,
      },
      // 5. screenshots select (service client — first turn card)
      { data: [{ game_id: 103, igdb_image_id: "sc_abc123" }], error: null },
      // 6. game_sessions insert (service client)
      { data: { id: gameSessionId }, error: null },
      // 7. game_players insert (service client)
      { data: null, error: null },
      // 8. rooms update (set playing)
      { data: { id: roomId }, error: null },
    );
  }

  it("creates a game session with deck, players, and first turn", async () => {
    authenticate(hostId);
    queueFullSuccess();

    const result = await startGame(roomId);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.gameSessionId).toBe(gameSessionId);
    // turnOrder is [player1, player2] (shuffle is a no-op in tests)
    expect(result.data.turnOrder).toEqual([player1, player2]);
    expect(result.data.firstCard.screenshotImageId).toBe("sc_abc123");
    // Starting cards keyed by userId
    expect(result.data.startingCards[player1]).toEqual({
      gameId: 101,
      releaseYear: 2000,
      name: "Game A",
    });
    expect(result.data.startingCards[player2]).toEqual({
      gameId: 102,
      releaseYear: 2010,
      name: "Game B",
    });
  });

  it("inserts a game_sessions row with correct current_turn and deck_cursor", async () => {
    authenticate(hostId);
    queueFullSuccess();

    await startGame(roomId);

    const sessionInsert = insertOperation(mocks.serviceOperations, "game_sessions");
    const payload = sessionInsert.payload as Record<string, unknown>;

    expect(payload["room_id"]).toBe(roomId);
    expect(payload["deck"]).toEqual(deck);
    expect(payload["deck_cursor"]).toBe(3); // 2 starting cards + 1 first turn card
    expect(payload["turn_order"]).toEqual([player1, player2]);
    expect(payload["active_player_id"]).toBe(player1);

    const currentTurn = payload["current_turn"] as Record<string, unknown>;
    expect(currentTurn["phase"]).toBe("placing");
    expect(currentTurn["activePlayerId"]).toBe(player1);
    expect(currentTurn["gameId"]).toBe(103);
    expect(currentTurn["screenshotImageId"]).toBe("sc_abc123");
  });

  it("inserts game_players rows with starting timelines and correct tokens", async () => {
    authenticate(hostId);
    queueFullSuccess();

    await startGame(roomId);

    const playersInsert = insertOperation(mocks.serviceOperations, "game_players");
    const rows = playersInsert.payload as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(2);

    const aliceRow = rows.find((r) => r["user_id"] === player1);
    expect(aliceRow).toBeDefined();
    expect(aliceRow?.["display_name"]).toBe("Alice");
    expect(aliceRow?.["tokens"]).toBe(2); // startingTokens from settings
    expect(aliceRow?.["turn_position"]).toBe(0);
    expect(aliceRow?.["timeline"]).toHaveLength(1);

    const bobRow = rows.find((r) => r["user_id"] === player2);
    expect(bobRow).toBeDefined();
    expect(bobRow?.["turn_position"]).toBe(1);
  });

  it("overrides PRO starting tokens to five for the session and players", async () => {
    authenticate(hostId);
    queueFullSuccess({ ...defaultSettings, startingTokens: 1, variant: "pro" });

    await startGame(roomId);

    const sessionInsert = insertOperation(mocks.serviceOperations, "game_sessions");
    expect((sessionInsert.payload as Record<string, unknown>)["settings"]).toMatchObject({
      startingTokens: 5,
      variant: "pro",
    });

    const playersInsert = insertOperation(mocks.serviceOperations, "game_players");
    const rows = playersInsert.payload as Array<Record<string, unknown>>;
    expect(rows.every((row) => row["tokens"] === 5)).toBe(true);
  });

  it("overrides EXPERT starting tokens to three for the session and players", async () => {
    authenticate(hostId);
    queueFullSuccess({ ...defaultSettings, startingTokens: 1, variant: "expert" });

    await startGame(roomId);

    const sessionInsert = insertOperation(mocks.serviceOperations, "game_sessions");
    expect((sessionInsert.payload as Record<string, unknown>)["settings"]).toMatchObject({
      startingTokens: 3,
      variant: "expert",
    });

    const playersInsert = insertOperation(mocks.serviceOperations, "game_players");
    const rows = playersInsert.payload as Array<Record<string, unknown>>;
    expect(rows.every((row) => row["tokens"] === 3)).toBe(true);
  });

  it("sets rooms.status to playing", async () => {
    authenticate(hostId);
    queueFullSuccess();

    await startGame(roomId);

    expect(updateOperation(mocks.operations, "rooms").payload).toEqual({ status: "playing" });
  });

  it("calls buildDeck with the room difficulty and house rules", async () => {
    authenticate(hostId);
    queueFullSuccess();

    await startGame(roomId);

    expect(mocks.mockBuildDeck).toHaveBeenCalledOnce();
    const [, difficulty, houseRules] = mocks.mockBuildDeck.mock.calls[0] as [
      unknown,
      string,
      unknown,
    ];
    expect(difficulty).toBe("easy");
    expect(houseRules).toEqual({
      genreLockId: null,
      consoleLockFamily: null,
      decadeStart: null,
    });
  });

  it("rejects game start when fewer than two players are present", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { count: 1, error: null },
    );

    const result = await startGame(roomId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "At least two players are required to start the game.",
      },
    });
  });

  it("rejects game start when the room is no longer in the lobby", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId, status: "playing", settings: null }, error: null },
      { count: 2, error: null },
    );

    const result = await startGame(roomId);

    expect(result).toEqual({
      success: false,
      error: { code: "CONFLICT", message: "This room is no longer in the lobby." },
    });
    expect(mocks.operations.some((op) => op.action === "update")).toBe(false);
  });

  it("returns INTERNAL_ERROR when deck building fails", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { count: 2, error: null },
      {
        data: [
          { user_id: player1, display_name: "Alice" },
          { user_id: player2, display_name: "Bob" },
        ],
        error: null,
      },
    );
    mocks.mockBuildDeck.mockRejectedValue(new Error("RPC failed"));

    const result = await startGame(roomId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to build the game deck. Please try again.",
      },
    });
  });

  it("returns INTERNAL_ERROR when deck is too small", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { count: 2, error: null },
      {
        data: [
          { user_id: player1, display_name: "Alice" },
          { user_id: player2, display_name: "Bob" },
        ],
        error: null,
      },
    );
    // Only 2 games, but need at least 3 (2 players + 1 first turn card).
    mocks.mockBuildDeck.mockResolvedValue([101, 102]);

    const result = await startGame(roomId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          "Not enough games are available for this difficulty. Try a different difficulty setting.",
      },
    });
  });
});

// ── claimHost ─────────────────────────────────────────────────────────────────

describe("claimHost", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";
  const callerId = "33333333-3333-4333-8333-333333333333";
  const newHostId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.queryResults.length = 0;
  });

  it("transfers host when the current host is absent from presence", async () => {
    authenticate(callerId);
    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { data: { status: "transferred", new_host_id: newHostId }, error: null },
    );

    const result = await claimHost(roomId, [callerId]);

    expect(result).toEqual({ success: true, data: { newHostId } });

    const rpcOp = mocks.operations.find((op) => op.action === "rpc");
    expect(rpcOp).toBeDefined();
    expect(rpcOp?.fn).toBe("claim_host");
    expect(rpcOp?.args).toEqual({ target_room_id: roomId, expected_host_id: hostId });
  });

  it("rejects when the host is still present in presence", async () => {
    authenticate(callerId);
    queueResults({ data: { host_id: hostId, status: "lobby", settings: null }, error: null });

    const result = await claimHost(roomId, [callerId, hostId]);

    expect(result).toEqual({
      success: false,
      error: { code: "CONFLICT", message: "The host is still connected — no transfer needed." },
    });
    expect(mocks.operations.some((op) => op.action === "rpc")).toBe(false);
  });

  it("returns CONFLICT when the host was already transferred (race condition)", async () => {
    authenticate(callerId);
    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { data: { status: "host_changed" }, error: null },
    );

    const result = await claimHost(roomId, [callerId]);

    expect(result).toEqual({
      success: false,
      error: { code: "CONFLICT", message: "Host was already transferred." },
    });
  });

  it("returns UNAUTHORIZED when the caller is already the host", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { data: { status: "already_host" }, error: null },
    );

    const result = await claimHost(roomId, [callerId]);

    expect(result).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "You are already the host." },
    });
  });

  it("returns CONFLICT when no players are available to become host", async () => {
    authenticate(callerId);
    queueResults(
      { data: { host_id: hostId, status: "lobby", settings: null }, error: null },
      { data: { status: "no_players" }, error: null },
    );

    const result = await claimHost(roomId, [callerId]);

    expect(result).toEqual({
      success: false,
      error: { code: "CONFLICT", message: "No players are available to become host." },
    });
  });

  it("returns NOT_FOUND when the room does not exist or is not in lobby", async () => {
    authenticate(callerId);
    queueResults({ data: null, error: null });

    const result = await claimHost(roomId, [callerId]);

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "That room no longer exists." },
    });
    expect(mocks.operations.some((op) => op.action === "rpc")).toBe(false);
  });
});
