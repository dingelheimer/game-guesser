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

import { updateSettings } from "./hostActions";

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
