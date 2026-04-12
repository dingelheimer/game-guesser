import { beforeEach, describe, expect, it, vi } from "vitest";

type MockQueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

type MockOperation = {
  action: "delete" | "insert" | "rpc" | "select" | "update";
  args?: unknown;
  columns?: string;
  fn?: string;
  options?: unknown;
  payload?: unknown;
  table?: string;
};

const mocks = vi.hoisted(() => {
  const queryResults: MockQueryResult[] = [];
  const rpcResults: MockQueryResult[] = [];
  const operations: MockOperation[] = [];
  const mockGetUser = vi.fn();
  const mockGenerateRoomCode = vi.fn();
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
      delete: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      error: result.error,
      in: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),
      select: vi.fn(() => chain),
      single: vi.fn(() => chain),
      update: vi.fn(() => chain),
    };

    return chain;
  }

  const mockFrom = vi.fn((table: string) => ({
    delete: vi.fn(() => {
      operations.push({ action: "delete", table });
      return createChain(takeResult());
    }),
    insert: vi.fn((payload: unknown) => {
      operations.push({ action: "insert", payload, table });
      return createChain(takeResult());
    }),
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
    operations.push({ action: "rpc", fn, ...(args === undefined ? {} : { args }) });
    const result = rpcResults.shift() ?? { data: 0, error: null };
    return { data: result.data ?? null, error: result.error ?? null };
  });

  const mockCreateClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }));

  return {
    mockCreateClient,
    mockFrom,
    mockGenerateRoomCode,
    mockGetUser,
    mockRevalidatePath,
    operations,
    queryResults,
    rpcResults,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.mockRevalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.mockCreateClient,
}));

vi.mock("./lobby", async () => {
  const actual = await vi.importActual("./lobby");

  return {
    ...actual,
    generateRoomCode: mocks.mockGenerateRoomCode,
  };
});

import { DEFAULT_LOBBY_SETTINGS } from "./lobby";
import { createRoom, joinRoom } from "./actions";

function queueResults(...results: readonly MockQueryResult[]) {
  mocks.queryResults.push(...results);
}

function queueRpcResults(...results: readonly MockQueryResult[]) {
  mocks.rpcResults.push(...results);
}

function authenticate(userId = "user-1") {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function unauthenticate() {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: null },
    error: new Error("Not authenticated"),
  });
}

function insertOperation(table: string, index = 0) {
  const operation = mocks.operations.filter(
    (entry): entry is MockOperation & { action: "insert" } =>
      entry.table === table && entry.action === "insert",
  )[index];

  if (operation === undefined) {
    throw new Error(`Expected an insert operation for ${table}.`);
  }

  return operation;
}

describe("createRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.queryResults.length = 0;
    mocks.rpcResults.length = 0;
    mocks.mockGenerateRoomCode.mockReset();
  });

  it("creates a room and host membership for the authenticated user", async () => {
    authenticate("host-1");
    mocks.mockGenerateRoomCode.mockReturnValue("ABC234");
    queueResults({ data: [] }, { data: { id: "room-1" } }, { error: null });

    const result = await createRoom("  Alex   Player  ");

    expect(result).toEqual({
      success: true,
      data: {
        roomCode: "ABC234",
        roomId: "room-1",
      },
    });
    expect(insertOperation("rooms").payload).toEqual({
      code: "ABC234",
      host_id: "host-1",
      settings: DEFAULT_LOBBY_SETTINGS,
    });
    expect(insertOperation("room_players").payload).toEqual({
      room_id: "room-1",
      user_id: "host-1",
      display_name: "Alex Player",
      role: "host",
    });
  });

  it("retries room code generation when a collision occurs", async () => {
    authenticate("host-1");
    mocks.mockGenerateRoomCode.mockReturnValueOnce("COLLID").mockReturnValueOnce("FREE22");
    queueResults(
      { data: [] },
      { error: { code: "23505", message: "duplicate key value violates unique constraint" } },
      { data: { id: "room-2" } },
      { error: null },
    );

    const result = await createRoom("Alex");

    expect(result).toEqual({
      success: true,
      data: {
        roomCode: "FREE22",
        roomId: "room-2",
      },
    });
    expect(mocks.mockGenerateRoomCode).toHaveBeenCalledTimes(2);
  });

  it("rejects room creation when the user is already in an active room", async () => {
    authenticate("host-1");
    queueResults({ data: [{ room_id: "room-active" }] }, { data: [{ id: "room-active" }] });

    const result = await createRoom("Alex");

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "You are already in an active room.",
        details: { activeRoomId: "room-active" },
      },
    });
  });

  it("rejects an invalid display name before contacting Supabase", async () => {
    unauthenticate();

    const result = await createRoom("A");

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Please enter a valid display name before creating a room.",
        fieldErrors: {
          displayName: ["Display name must be between 2 and 20 characters."],
        },
      },
    });
    expect(mocks.mockCreateClient).not.toHaveBeenCalled();
    expect(mocks.mockGetUser).not.toHaveBeenCalled();
  });
  it("calls abandon_stale_rooms before checking for active rooms", async () => {
    authenticate("host-1");
    mocks.mockGenerateRoomCode.mockReturnValue("ABC234");
    queueResults({ data: [] }, { data: { id: "room-1" } }, { error: null });

    await createRoom("Alex");

    const rpcOp = mocks.operations.find((op) => op.action === "rpc" && op.fn === "abandon_stale_rooms");
    expect(rpcOp).toBeDefined();

    const rpcIndex = rpcOp === undefined ? -1 : mocks.operations.indexOf(rpcOp);
    const firstSelectIndex = mocks.operations.findIndex(
      (op) => op.action === "select" && op.table === "room_players",
    );
    expect(rpcIndex).toBeLessThan(firstSelectIndex);
  });

  it("proceeds with room creation even if abandon_stale_rooms fails", async () => {
    authenticate("host-1");
    mocks.mockGenerateRoomCode.mockReturnValue("ABC234");
    queueRpcResults({ data: null, error: { message: "RPC error" } });
    queueResults({ data: [] }, { data: { id: "room-1" } }, { error: null });

    const result = await createRoom("Alex");

    expect(result).toEqual({
      success: true,
      data: { roomCode: "ABC234", roomId: "room-1" },
    });
  });
});

describe("joinRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.queryResults.length = 0;
    mocks.rpcResults.length = 0;
    mocks.mockGenerateRoomCode.mockReset();
  });

  it("joins an open lobby room successfully", async () => {
    authenticate("player-1");
    queueResults(
      { data: { id: "room-1", max_players: 10 } },
      { data: [] },
      { error: null },
      { data: { status: "lobby", max_players: 10 } },
      { count: 2, error: null },
    );

    const result = await joinRoom("ab2cd3", "  Sam   Player ");

    expect(result).toEqual({
      success: true,
      data: {
        roomId: "room-1",
      },
    });
    expect(insertOperation("room_players").payload).toEqual({
      room_id: "room-1",
      user_id: "player-1",
      display_name: "Sam Player",
    });
  });

  it("returns not found when the room code does not match an open lobby", async () => {
    authenticate("player-1");
    queueResults({ data: null, error: null });

    const result = await joinRoom("ABC234", "Player One");

    expect(result).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "That room code does not match an open lobby.",
      },
    });
  });

  it("returns conflict with activeRoomId when the user is already in another active room", async () => {
    authenticate("player-1");
    queueResults(
      { data: { id: "room-1", max_players: 10 } },
      { data: [{ room_id: "room-other" }] },
      { data: [{ id: "room-other" }] },
    );

    const result = await joinRoom("ABC234", "Player One");

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "You are already in another active room.",
        details: { activeRoomId: "room-other" },
      },
    });
  });

  it("returns conflict when the user is already in the target room", async () => {
    authenticate("player-1");
    queueResults(
      { data: { id: "room-1", max_players: 10 } },
      { data: [{ room_id: "room-1" }] },
      { data: [{ id: "room-1" }] },
    );

    const result = await joinRoom("ABC234", "Player One");

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "You are already in this room.",
      },
    });
  });

  it("returns conflict and cleans up when the room becomes full", async () => {
    authenticate("player-1");
    queueResults(
      { data: { id: "room-1", max_players: 2 } },
      { data: [] },
      { error: null },
      { data: { status: "lobby", max_players: 2 } },
      { count: 3, error: null },
      { error: null },
    );

    const result = await joinRoom("ABC234", "Player One");

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "This room is full.",
      },
    });
    expect(
      mocks.operations.some(
        (operation) => operation.table === "room_players" && operation.action === "delete",
      ),
    ).toBe(true);
  });

  it("rejects invalid room code format before contacting Supabase", async () => {
    authenticate("player-1");

    const result = await joinRoom("A1B2C3", "Player One");

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Please provide a valid room code and display name before joining.",
        fieldErrors: {
          code: ["Room code must be 6 characters using letters A-H, J-N, P-Z, and digits 2-9."],
        },
      },
    });
    expect(mocks.mockCreateClient).not.toHaveBeenCalled();
  });

  it("rejects invalid display names before contacting Supabase", async () => {
    authenticate("player-1");

    const result = await joinRoom("ABC234", "Alex!");

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Please provide a valid room code and display name before joining.",
        fieldErrors: {
          displayName: ["Display name can only contain letters, numbers, spaces, and underscores."],
        },
      },
    });
    expect(mocks.mockCreateClient).not.toHaveBeenCalled();
  });

  it("calls abandon_stale_rooms before checking for active rooms", async () => {
    authenticate("player-1");
    queueResults(
      { data: { id: "room-1", max_players: 10 } },
      { data: [] },
      { error: null },
      { data: { status: "lobby", max_players: 10 } },
      { count: 2, error: null },
    );

    await joinRoom("ab2cd3", "Sam");

    const rpcOp = mocks.operations.find((op) => op.action === "rpc" && op.fn === "abandon_stale_rooms");
    expect(rpcOp).toBeDefined();

    const rpcIndex = rpcOp === undefined ? -1 : mocks.operations.indexOf(rpcOp);
    const firstRoomPlayersSelectIndex = mocks.operations.findIndex(
      (op) => op.action === "select" && op.table === "room_players",
    );
    expect(rpcIndex).toBeLessThan(firstRoomPlayersSelectIndex);
  });
});
