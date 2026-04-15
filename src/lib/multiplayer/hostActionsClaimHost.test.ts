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

import { claimHost } from "./hostActions";

function queueResults(...results: readonly MockQueryResult[]) {
  mocks.queryResults.push(...results);
}

function authenticate(userId = "user-1") {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

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
