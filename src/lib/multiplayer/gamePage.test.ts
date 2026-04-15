// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMultiplayerGamePageData } from "./gamePage";

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
      in: vi.fn(() => chain),
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

describe("getMultiplayerGamePageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryResults.length = 0;
  });

  it("returns hydrated multiplayer game data for an active session member", async () => {
    authenticate();
    queueResults(
      {
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          room_id: "33333333-3333-4333-8333-333333333333",
          status: "active",
          current_turn: {
            phase: "placing",
            activePlayerId: "11111111-1111-4111-8111-111111111111",
            gameId: 900,
            screenshotImageId: "shot-900",
            phaseDeadline: "2026-04-12T12:00:00.000Z",
          },
          turn_number: 4,
          active_player_id: "11111111-1111-4111-8111-111111111111",
          settings: {
            difficulty: "easy",
            turnTimer: "60",
            tokensEnabled: true,
            startingTokens: 2,
            winCondition: 7,
            variant: "standard",
          },
          winner_id: null,
        },
      },
      {
        data: [
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            display_name: "Alex Host",
            score: 3,
            tokens: 2,
            turn_position: 0,
            timeline: [{ gameId: 10, releaseYear: 1998, name: "Half-Life" }],
          },
          {
            user_id: "44444444-4444-4444-8444-444444444444",
            display_name: "Sam Player",
            score: 1,
            tokens: 4,
            turn_position: 1,
            timeline: [{ gameId: 20, releaseYear: 2003, name: "Prince of Persia" }],
          },
        ],
      },
      {
        data: [
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            role: "host",
            joined_at: "2026-04-11T22:00:00.000Z",
          },
          {
            user_id: "44444444-4444-4444-8444-444444444444",
            role: "player",
            joined_at: "2026-04-11T22:01:00.000Z",
          },
        ],
      },
      {
        data: [
          { game_id: 10, igdb_image_id: "cover-10" },
          { game_id: 20, igdb_image_id: "cover-20" },
        ],
      },
      {
        data: [
          { game_id: 10, platform_id: 100 },
          { game_id: 20, platform_id: 200 },
        ],
      },
      {
        data: [
          { id: 100, name: "PC" },
          { id: 200, name: "PlayStation 2" },
        ],
      },
    );

    const result = await getMultiplayerGamePageData("22222222-2222-4222-8222-222222222222");

    expect(result).toEqual({
      currentTurn: {
        activePlayerId: "11111111-1111-4111-8111-111111111111",
        card: {
          gameId: 900,
          screenshotImageId: "shot-900",
          coverImageId: null,
          title: "?",
          releaseYear: null,
          platform: "",
          isRevealed: false,
        },
        phase: "placing",
        phaseDeadline: "2026-04-12T12:00:00.000Z",
        platformOptions: [],
      },
      currentUserId: "11111111-1111-4111-8111-111111111111",
      players: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          displayName: "Alex Host",
          joinedAt: "2026-04-11T22:00:00.000Z",
          role: "host",
          score: 3,
          tokens: 2,
          turnPosition: 0,
          timeline: [
            {
              gameId: 10,
              coverImageId: "cover-10",
              title: "Half-Life",
              releaseYear: 1998,
              platform: "PC",
              isRevealed: true,
              screenshotImageId: null,
            },
          ],
        },
        {
          userId: "44444444-4444-4444-8444-444444444444",
          displayName: "Sam Player",
          joinedAt: "2026-04-11T22:01:00.000Z",
          role: "player",
          score: 1,
          tokens: 4,
          turnPosition: 1,
          timeline: [
            {
              gameId: 20,
              coverImageId: "cover-20",
              title: "Prince of Persia",
              releaseYear: 2003,
              platform: "PlayStation 2",
              isRevealed: true,
              screenshotImageId: null,
            },
          ],
        },
      ],
      roomId: "33333333-3333-4333-8333-333333333333",
      sessionId: "22222222-2222-4222-8222-222222222222",
      settings: {
        difficulty: "easy",
        turnTimer: "60",
        tokensEnabled: true,
        startingTokens: 2,
        winCondition: 7,
        gameMode: "competitive",
        variant: "standard",
        genreLockId: null,
        consoleLockFamily: null,
        decadeStart: null,
        speedRound: false,
      },
      status: "active",
      teamScore: null,
      teamTimeline: null,
      teamTokens: null,
      turnNumber: 4,
      winner: null,
    });
  });

  it("returns hydrated finished-session data for the multiplayer game-over screen", async () => {
    authenticate();
    queueResults(
      {
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          room_id: "33333333-3333-4333-8333-333333333333",
          status: "finished",
          current_turn: {
            phase: "complete",
            activePlayerId: "11111111-1111-4111-8111-111111111111",
            gameId: 30,
            screenshotImageId: "shot-930",
          },
          turn_number: 4,
          active_player_id: "11111111-1111-4111-8111-111111111111",
          settings: {
            difficulty: "easy",
            turnTimer: "60",
            tokensEnabled: true,
            startingTokens: 2,
            winCondition: 7,
            variant: "standard",
          },
          winner_id: "44444444-4444-4444-8444-444444444444",
        },
      },
      {
        data: [
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            display_name: "Alex Host",
            score: 4,
            tokens: 2,
            turn_position: 0,
            timeline: [{ gameId: 10, releaseYear: 1998, name: "Half-Life" }],
          },
          {
            user_id: "44444444-4444-4444-8444-444444444444",
            display_name: "Sam Player",
            score: 7,
            tokens: 3,
            turn_position: 1,
            timeline: [
              { gameId: 20, releaseYear: 2003, name: "Prince of Persia" },
              { gameId: 30, releaseYear: 2007, name: "BioShock" },
            ],
          },
        ],
      },
      {
        data: [
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            role: "host",
            joined_at: "2026-04-11T22:00:00.000Z",
          },
          {
            user_id: "44444444-4444-4444-8444-444444444444",
            role: "player",
            joined_at: "2026-04-11T22:01:00.000Z",
          },
        ],
      },
      {
        data: [
          { game_id: 10, igdb_image_id: "cover-10" },
          { game_id: 20, igdb_image_id: "cover-20" },
          { game_id: 30, igdb_image_id: "cover-30" },
        ],
      },
      {
        data: [
          { game_id: 10, platform_id: 100 },
          { game_id: 20, platform_id: 200 },
          { game_id: 30, platform_id: 300 },
        ],
      },
      {
        data: [
          { id: 100, name: "PC" },
          { id: 200, name: "PlayStation 2" },
          { id: 300, name: "Xbox 360" },
        ],
      },
      {
        data: {
          id: 30,
          name: "BioShock",
          release_year: 2007,
        },
      },
    );

    const result = await getMultiplayerGamePageData("22222222-2222-4222-8222-222222222222");

    expect(result?.status).toBe("finished");
    expect(result?.winner).toEqual({
      displayName: "Sam Player",
      userId: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("returns null when the session is abandoned or missing", async () => {
    authenticate();
    queueResults(
      {
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          room_id: "33333333-3333-4333-8333-333333333333",
          status: "abandoned",
          current_turn: {
            phase: "placing",
            activePlayerId: "11111111-1111-4111-8111-111111111111",
            gameId: 900,
            screenshotImageId: "shot-900",
          },
          turn_number: 4,
          active_player_id: "11111111-1111-4111-8111-111111111111",
          settings: {},
          winner_id: null,
        },
      },
      { data: [] },
    );

    const result = await getMultiplayerGamePageData("22222222-2222-4222-8222-222222222222");

    expect(result).toBeNull();
  });

  it("returns null for an invalid session id or unauthenticated user", async () => {
    const invalidSessionResult = await getMultiplayerGamePageData("not-a-session-id");

    expect(invalidSessionResult).toBeNull();
    expect(mocks.mockCreateClient).not.toHaveBeenCalled();

    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    const signedOutResult = await getMultiplayerGamePageData(
      "22222222-2222-4222-8222-222222222222",
    );

    expect(signedOutResult).toBeNull();
  });
});
