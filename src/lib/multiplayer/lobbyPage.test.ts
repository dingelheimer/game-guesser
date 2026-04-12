import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLobbyRoomPageData } from "./lobbyPage";

type MockQueryResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

const mocks = vi.hoisted(() => {
  const queryResults: MockQueryResult[] = [];
  const mockGetUser = vi.fn();

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
      eq: vi.fn(() => chain),
      error: result.error,
      maybeSingle: vi.fn(() => chain),
      order: vi.fn(() => chain),
      select: vi.fn(() => chain),
    };

    return chain;
  }

  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => createChain(takeResult())),
  }));

  const mockCreateClient = vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }));

  return {
    mockCreateClient,
    mockGetUser,
    queryResults,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.mockCreateClient,
}));

function queueResults(...results: readonly MockQueryResult[]) {
  mocks.queryResults.push(...results);
}

function authenticate(userId = "11111111-1111-4111-8111-111111111111") {
  mocks.mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

describe("getLobbyRoomPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryResults.length = 0;
  });

  it("returns the lobby room payload for a signed-in room member", async () => {
    authenticate();
    queueResults(
      { data: { user_id: "11111111-1111-4111-8111-111111111111" } },
      {
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          code: "ABC234",
          host_id: "11111111-1111-4111-8111-111111111111",
          max_players: 10,
          settings: {
            difficulty: "easy",
            turnTimer: "60",
            tokensEnabled: true,
            startingTokens: 2,
            winCondition: 10,
            variant: "standard",
          },
          status: "lobby",
        },
      },
      {
        data: [
          {
            display_name: "Alex Host",
            joined_at: "2026-04-11T22:00:00.000Z",
            role: "host",
            user_id: "11111111-1111-4111-8111-111111111111",
          },
          {
            display_name: "Sam Player",
            joined_at: "2026-04-11T22:01:00.000Z",
            role: "player",
            user_id: "33333333-3333-4333-8333-333333333333",
          },
        ],
      },
    );

    const result = await getLobbyRoomPageData("22222222-2222-4222-8222-222222222222");

    expect(result).toEqual({
      currentUserId: "11111111-1111-4111-8111-111111111111",
      hostId: "11111111-1111-4111-8111-111111111111",
      maxPlayers: 10,
      players: [
        {
          displayName: "Alex Host",
          joinedAt: "2026-04-11T22:00:00.000Z",
          role: "host",
          userId: "11111111-1111-4111-8111-111111111111",
        },
        {
          displayName: "Sam Player",
          joinedAt: "2026-04-11T22:01:00.000Z",
          role: "player",
          userId: "33333333-3333-4333-8333-333333333333",
        },
      ],
      roomCode: "ABC234",
      roomId: "22222222-2222-4222-8222-222222222222",
      settings: {
        difficulty: "easy",
        turnTimer: "60",
        tokensEnabled: true,
        startingTokens: 2,
        winCondition: 10,
        variant: "standard",
      },
    });
  });

  it("returns null when the current user is not a member of the room", async () => {
    authenticate();
    queueResults(
      { data: null },
      {
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          code: "ABC234",
          host_id: "11111111-1111-4111-8111-111111111111",
          max_players: 10,
          settings: {
            difficulty: "easy",
            turnTimer: "60",
            tokensEnabled: true,
            startingTokens: 2,
            winCondition: 10,
            variant: "standard",
          },
          status: "lobby",
        },
      },
    );

    const result = await getLobbyRoomPageData("22222222-2222-4222-8222-222222222222");

    expect(result).toBeNull();
  });

  it("returns null when the room id is invalid or the user is not authenticated", async () => {
    const invalidRoomResult = await getLobbyRoomPageData("not-a-room-id");

    expect(invalidRoomResult).toBeNull();
    expect(mocks.mockCreateClient).not.toHaveBeenCalled();

    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    const signedOutResult = await getLobbyRoomPageData("22222222-2222-4222-8222-222222222222");

    expect(signedOutResult).toBeNull();
  });
});
