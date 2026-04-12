import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockQueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

type MockOperation = {
  action: "select" | "update" | "rpc";
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
  const mockGetUser = vi.fn();
  const mockRevalidatePath = vi.fn();

  function takeResult() {
    const result = queryResults.shift();
    if (result === undefined) {
      throw new Error("No queued Supabase result for this query.");
    }

    return {
      count: result.count ?? null,
      data: result.data ?? null,
      error: result.error ?? null,
    };
  }

  function createChain(result: ReturnType<typeof takeResult>) {
    const chain = {
      count: result.count,
      data: result.data,
      eq: vi.fn(() => chain),
      error: result.error,
      maybeSingle: vi.fn(() => chain),
      select: vi.fn(() => chain),
      update: vi.fn(() => chain),
    };

    return chain;
  }

  const mockFrom = vi.fn((table: string) => ({
    select: vi.fn((columns?: string, options?: unknown) => {
      operations.push({
        action: "select",
        ...(columns === undefined ? {} : { columns }),
        ...(options === undefined ? {} : { options }),
        table,
      });
      return createChain(takeResult());
    }),
    update: vi.fn((payload: unknown) => {
      operations.push({ action: "update", payload, table });
      return createChain(takeResult());
    }),
  }));

  const mockRpc = vi.fn((fn: string, args?: unknown) => {
    operations.push({ action: "rpc" as const, fn, ...(args === undefined ? {} : { args }) });
    return takeResult();
  });

  const mockCreateClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }));

  return {
    mockCreateClient,
    mockGetUser,
    mockRevalidatePath,
    operations,
    queryResults,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.mockRevalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.mockCreateClient,
}));

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

function updateOperation(table: string, index = 0) {
  const operation = mocks.operations.filter(
    (entry): entry is MockOperation & { action: "update" } =>
      entry.table === table && entry.action === "update",
  )[index];

  if (operation === undefined) {
    throw new Error(`Expected an update operation for ${table}.`);
  }

  return operation;
}

describe("updateSettings", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
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
      variant: "expert",
    } as const;

    queueResults({ data: { host_id: hostId, status: "lobby" }, error: null }, { error: null });

    const result = await updateSettings(roomId, settings);

    expect(result).toEqual({
      success: true,
      data: {
        roomId,
        settings,
      },
    });
    expect(updateOperation("rooms").payload).toEqual({ settings });
  });

  it("rejects settings updates from non-host players", async () => {
    authenticate("33333333-3333-4333-8333-333333333333");

    queueResults({ data: { host_id: hostId, status: "lobby" }, error: null });

    const result = await updateSettings(roomId, {
      difficulty: "medium",
      turnTimer: "60",
      tokensEnabled: true,
      startingTokens: 2,
      winCondition: 10,
      variant: "standard",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only the host can update room settings.",
      },
    });
    expect(mocks.operations.some((operation) => operation.action === "update")).toBe(false);
  });
});

describe("startGame", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";
  const gameSessionId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.queryResults.length = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(gameSessionId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts the game for a lobby with at least two players", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId, status: "lobby" }, error: null },
      { count: 2, error: null },
      { data: { id: roomId }, error: null },
    );

    const result = await startGame(roomId);

    expect(result).toEqual({
      success: true,
      data: { gameSessionId },
    });
    expect(updateOperation("rooms").payload).toEqual({ status: "playing" });
  });

  it("rejects game start when fewer than two players are present", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId, status: "lobby" }, error: null },
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
      { data: { host_id: hostId, status: "playing" }, error: null },
      { count: 2, error: null },
    );

    const result = await startGame(roomId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "This room is no longer in the lobby.",
      },
    });
    expect(mocks.operations.some((operation) => operation.action === "update")).toBe(false);
  });
});

describe("claimHost", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";
  const callerId = "33333333-3333-4333-8333-333333333333";
  const newHostId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.queryResults.length = 0;
  });

  it("transfers host when the current host is absent from presence", async () => {
    authenticate(callerId);
    queueResults(
      { data: { host_id: hostId, status: "lobby" }, error: null },
      {
        data: { status: "transferred", new_host_id: newHostId },
        error: null,
      },
    );

    const result = await claimHost(roomId, [callerId]);

    expect(result).toEqual({
      success: true,
      data: { newHostId },
    });

    const rpcOp = mocks.operations.find((op) => op.action === "rpc");
    expect(rpcOp).toBeDefined();
    expect(rpcOp?.fn).toBe("claim_host");
    expect(rpcOp?.args).toEqual({ target_room_id: roomId, expected_host_id: hostId });
  });

  it("rejects when the host is still present in presence", async () => {
    authenticate(callerId);
    queueResults({ data: { host_id: hostId, status: "lobby" }, error: null });

    const result = await claimHost(roomId, [callerId, hostId]);

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "The host is still connected — no transfer needed.",
      },
    });
    expect(mocks.operations.some((op) => op.action === "rpc")).toBe(false);
  });

  it("returns CONFLICT when the host was already transferred (race condition)", async () => {
    authenticate(callerId);
    queueResults(
      { data: { host_id: hostId, status: "lobby" }, error: null },
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
      { data: { host_id: hostId, status: "lobby" }, error: null },
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
      { data: { host_id: hostId, status: "lobby" }, error: null },
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
