import { beforeEach, describe, expect, it, vi } from "vitest";

type MockQueryResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

type MockOperation =
  | {
      action: "delete";
      table: string;
    }
  | {
      action: "select";
      columns?: string;
      table: string;
    }
  | {
      action: "rpc";
      args?: unknown;
      fn: string;
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
      data: result.data ?? null,
      error: result.error ?? null,
    };
  }

  function createChain(result: ReturnType<typeof takeResult>) {
    const chain = {
      data: result.data,
      delete: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      error: result.error,
      maybeSingle: vi.fn(() => chain),
      select: vi.fn(() => chain),
    };

    return chain;
  }

  const mockFrom = vi.fn((table: string) => ({
    delete: vi.fn(() => {
      operations.push({ action: "delete", table });
      return createChain(takeResult());
    }),
    select: vi.fn((columns?: string) => {
      operations.push({
        action: "select",
        ...(columns === undefined ? {} : { columns }),
        table,
      });
      return createChain(takeResult());
    }),
  }));

  const mockRpc = vi.fn((fn: string, args?: unknown) => {
    operations.push({ action: "rpc", fn, ...(args === undefined ? {} : { args }) });
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

import { kickPlayer, leaveRoom } from "./actions";

function queueResults(...results: readonly MockQueryResult[]) {
  mocks.queryResults.push(...results);
}

function authenticate(userId = "user-1") {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function deleteOperation(table: string, index = 0) {
  const operation = mocks.operations.filter(
    (entry): entry is Extract<MockOperation, { action: "delete" }> =>
      entry.action === "delete" && entry.table === table,
  )[index];

  if (operation === undefined) {
    throw new Error(`Expected a delete operation for ${table}.`);
  }

  return operation;
}

function rpcOperation(fn: string, index = 0) {
  const operation = mocks.operations.filter(
    (entry): entry is Extract<MockOperation, { action: "rpc" }> =>
      entry.action === "rpc" && entry.fn === fn,
  )[index];

  if (operation === undefined) {
    throw new Error(`Expected an rpc operation for ${fn}.`);
  }

  return operation;
}

describe("leaveRoom", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.queryResults.length = 0;
  });

  it("lets a non-host player leave a room", async () => {
    authenticate("player-1");
    queueResults({ data: "left", error: null });

    const result = await leaveRoom(roomId);

    expect(result).toEqual({
      success: true,
      data: { roomId },
    });
    expect(rpcOperation("leave_room").args).toEqual({ target_room_id: roomId });
  });

  it("transfers host ownership when the host leaves and players remain", async () => {
    authenticate("host-1");
    queueResults({ data: "transferred", error: null });

    const result = await leaveRoom(roomId);

    expect(result).toEqual({
      success: true,
      data: { roomId },
    });
  });

  it("abandons the room when the last player leaves", async () => {
    authenticate("host-1");
    queueResults({ data: "abandoned", error: null });

    const result = await leaveRoom(roomId);

    expect(result).toEqual({
      success: true,
      data: { roomId },
    });
  });
});

describe("kickPlayer", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";
  const targetUserId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.queryResults.length = 0;
  });

  it("lets the host kick a non-host player", async () => {
    authenticate(hostId);
    queueResults(
      { data: { host_id: hostId }, error: null },
      { data: { role: "player" }, error: null },
      { error: null },
    );

    const result = await kickPlayer(roomId, targetUserId);

    expect(result).toEqual({
      success: true,
      data: {
        roomId,
        targetUserId,
      },
    });
    expect(deleteOperation("room_players")).toEqual({
      action: "delete",
      table: "room_players",
    });
  });

  it("rejects kick requests from non-host players", async () => {
    authenticate(targetUserId);
    queueResults({ data: { host_id: hostId }, error: null });

    const result = await kickPlayer(roomId, "44444444-4444-4444-8444-444444444444");

    expect(result).toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only the host can remove players from this room.",
      },
    });
  });

  it("rejects self-kick attempts", async () => {
    authenticate(hostId);

    const result = await kickPlayer(roomId, hostId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "You cannot kick yourself out of the room.",
      },
    });
    expect(mocks.operations).toEqual([]);
  });
});
