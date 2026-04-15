// SPDX-License-Identifier: AGPL-3.0-only
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
    fisherYatesShuffle: <T>(arr: T[]): T[] => arr,
  };
});

import { startGame } from "./hostActions";

function queueResults(...results: readonly MockQueryResult[]) {
  mocks.queryResults.push(...results);
}

function authenticate(userId = "user-1") {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

// ── startGame (validation / error paths) ──────────────────────────────────────

describe("startGame — validation", () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const hostId = "22222222-2222-4222-8222-222222222222";
  const player1 = "33333333-3333-4333-8333-333333333333";
  const player2 = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.serviceOperations.length = 0;
    mocks.queryResults.length = 0;
    mocks.mockBuildDeck.mockResolvedValue([101, 102, 103, 104, 105]);
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
