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

import { submitTeamVote } from "./teamVoteActions";

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
