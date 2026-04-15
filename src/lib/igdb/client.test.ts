// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildQuery } from "./apicalypse";
import {
  IgdbError,
  MIN_REQUEST_INTERVAL_MS,
  __testing,
  fetchCovers,
  fetchGames,
  fetchGenres,
  fetchPlatforms,
  fetchScreenshots,
} from "./client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TOKEN_RESPONSE = {
  access_token: "test-access-token",
  expires_in: 3600,
  token_type: "bearer",
};

const VALID_GAME = {
  id: 1,
  name: "Half-Life",
  first_release_date: 912470400,
  cover: { id: 10, image_id: "co1wyy" },
  screenshots: [{ id: 20, image_id: "sc1abc" }],
};

/** Build a mock Response object. */
function mockResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stub fetch to return token then data responses in sequence. */
function stubFetchSequence(...responses: Response[]) {
  const queue = [...responses];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      const next = queue.shift();
      if (!next) throw new Error("Unexpected fetch call — no more mock responses");
      return Promise.resolve(next);
    }),
  );
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  __testing.reset();
  process.env.TWITCH_CLIENT_ID = "test-client-id";
  process.env.TWITCH_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
});

// ---------------------------------------------------------------------------
// Apicalypse query builder
// ---------------------------------------------------------------------------

describe("buildQuery", () => {
  it("serializes all fields", () => {
    const result = buildQuery({
      fields: ["id", "name", "cover.image_id"],
      where: "category = 0",
      sort: "first_release_date asc",
      limit: 500,
      offset: 100,
    });
    expect(result).toBe(
      "fields id, name, cover.image_id;\nwhere category = 0;\nsort first_release_date asc;\nlimit 500;\noffset 100;",
    );
  });

  it("accepts fields as a string", () => {
    expect(buildQuery({ fields: "*" })).toBe("fields *;");
  });

  it("serializes exclude", () => {
    expect(buildQuery({ fields: "*", exclude: ["summary", "slug"] })).toBe(
      "fields *;\nexclude summary, slug;",
    );
  });

  it("serializes search with quotes", () => {
    expect(buildQuery({ search: "Zelda" })).toBe('search "Zelda";');
  });

  it("returns empty string for empty query", () => {
    expect(buildQuery({})).toBe("");
  });

  it("omits offset when not provided", () => {
    const result = buildQuery({ fields: "id", limit: 10 });
    expect(result).not.toContain("offset");
    expect(result).toBe("fields id;\nlimit 10;");
  });
});

// ---------------------------------------------------------------------------
// IgdbError
// ---------------------------------------------------------------------------

describe("IgdbError", () => {
  it("has correct name and code", () => {
    const err = new IgdbError("rate_limit", "too fast", 429);
    expect(err.name).toBe("IgdbError");
    expect(err.code).toBe("rate_limit");
    expect(err.message).toBe("too fast");
    expect(err.status).toBe(429);
    expect(err).toBeInstanceOf(Error);
  });

  it("status is optional", () => {
    const err = new IgdbError("network_error", "offline");
    expect(err.status).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

describe("token management", () => {
  it("fetches a new token on first request", async () => {
    stubFetchSequence(mockResponse(VALID_TOKEN_RESPONSE), mockResponse([VALID_GAME]));

    const results = await fetchGames("fields id, name;");

    expect(results).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);

    // First call is to Twitch OAuth
    const [tokenCall] = vi.mocked(fetch).mock.calls;
    expect(tokenCall?.[0]).toContain("id.twitch.tv");
  });

  it("reuses a cached token for subsequent requests", async () => {
    // Seed token cache — expires far in the future
    __testing.setTokenCache({
      accessToken: "cached-token",
      expiresAt: Date.now() + 3_600_000,
    });

    stubFetchSequence(mockResponse([VALID_GAME]));

    await fetchGames("fields id;");

    // Only one fetch (no token refresh)
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired token automatically", async () => {
    // Seed an expired token
    __testing.setTokenCache({
      accessToken: "expired-token",
      expiresAt: Date.now() - 1,
    });

    stubFetchSequence(
      mockResponse(VALID_TOKEN_RESPONSE), // token refresh
      mockResponse([VALID_GAME]),
    );

    await fetchGames("fields id;");

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("re-fetches token on 401 response and retries", async () => {
    // First token is stale (valid cache, but server rejects it)
    __testing.setTokenCache({
      accessToken: "stale-token",
      expiresAt: Date.now() + 3_600_000,
    });

    stubFetchSequence(
      mockResponse(null, 401, "Unauthorized"), // IGDB rejects stale token
      mockResponse(VALID_TOKEN_RESPONSE), // token refresh
      mockResponse([VALID_GAME]), // retry succeeds
    );

    const results = await fetchGames("fields id;");

    expect(results).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws IgdbError(unauthorized) when Twitch auth fails", async () => {
    stubFetchSequence(mockResponse({ message: "Forbidden" }, 403, "Forbidden"));

    await expect(fetchGames("fields id;")).rejects.toMatchObject({
      code: "unauthorized",
      status: 403,
    });
  });

  it("throws IgdbError(unauthorized) when credentials are missing", async () => {
    delete process.env.TWITCH_CLIENT_ID;

    await expect(fetchGames("fields id;")).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("throws IgdbError(network_error) on Twitch auth network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));

    await expect(fetchGames("fields id;")).rejects.toMatchObject({
      code: "network_error",
    });
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  beforeEach(() => {
    __testing.setTokenCache({
      accessToken: "valid-token",
      expiresAt: Date.now() + 3_600_000,
    });
  });

  it("throws IgdbError(rate_limit) on 429", async () => {
    stubFetchSequence(mockResponse(null, 429, "Too Many Requests"));

    await expect(fetchGames("fields id;")).rejects.toMatchObject({
      code: "rate_limit",
      status: 429,
    });
  });

  it("throws IgdbError(api_error) on 500", async () => {
    stubFetchSequence(mockResponse({ message: "Server Error" }, 500, "Internal Server Error"));

    await expect(fetchGames("fields id;")).rejects.toMatchObject({
      code: "api_error",
      status: 500,
    });
  });

  it("throws IgdbError(network_error) on fetch rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchGames("fields id;")).rejects.toMatchObject({
      code: "network_error",
    });
  });
});

// ---------------------------------------------------------------------------
// Typed fetch functions
// ---------------------------------------------------------------------------

describe("typed fetch functions", () => {
  beforeEach(() => {
    __testing.setTokenCache({
      accessToken: "valid-token",
      expiresAt: Date.now() + 3_600_000,
    });
  });

  it("fetchGames returns IgdbGame[]", async () => {
    const game = { id: 1, name: "Half-Life", first_release_date: 912470400 };
    stubFetchSequence(mockResponse([game]));

    const results = await fetchGames("fields id, name, first_release_date;");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(game);
  });

  it("fetchCovers returns IgdbCover[]", async () => {
    const cover = { id: 10, image_id: "co1wyy", width: 264, height: 374 };
    stubFetchSequence(mockResponse([cover]));

    const results = await fetchCovers("fields id, image_id, width, height;");

    expect(results[0]).toEqual(cover);
  });

  it("fetchScreenshots returns IgdbScreenshot[]", async () => {
    const shot = { id: 20, image_id: "sc1abc", width: 889, height: 500 };
    stubFetchSequence(mockResponse([shot]));

    const results = await fetchScreenshots("fields id, image_id, width, height;");

    expect(results[0]).toEqual(shot);
  });

  it("fetchPlatforms returns IgdbPlatform[]", async () => {
    const platform = { id: 6, name: "PC (Microsoft Windows)", slug: "win" };
    stubFetchSequence(mockResponse([platform]));

    const results = await fetchPlatforms("fields id, name, slug;");

    expect(results[0]).toEqual(platform);
  });

  it("fetchGenres returns IgdbGenre[]", async () => {
    const genre = { id: 12, name: "Role-playing (RPG)", slug: "role-playing-rpg" };
    stubFetchSequence(mockResponse([genre]));

    const results = await fetchGenres("fields id, name, slug;");

    expect(results[0]).toEqual(genre);
  });

  it("sends query body and correct headers", async () => {
    stubFetchSequence(mockResponse([]));
    const fetchMock = vi.mocked(fetch);

    const query = "fields id, name;\nwhere category = 0;\nlimit 500;";
    await fetchGames(query);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const url = firstCall?.[0];
    const init = firstCall?.[1] as (RequestInit & { headers: Record<string, string> }) | undefined;
    expect(url).toContain("api.igdb.com/v4/games");
    expect(init?.body).toBe(query);
    expect(init?.headers["Client-ID"]).toBe("test-client-id");
    expect(init?.headers["Authorization"]).toBe("Bearer valid-token");
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("rate limiting", () => {
  beforeEach(() => {
    __testing.setTokenCache({
      accessToken: "valid-token",
      expiresAt: Date.now() + 3_600_000,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not delay when enough time has passed since last request", async () => {
    // Last request was 1 second ago — no wait needed
    __testing.setLastRequestTime(Date.now() - 1000);
    stubFetchSequence(mockResponse([]));

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const promise = fetchGames("fields id;");
    await vi.runAllTimersAsync();
    await promise;

    // setTimeout should not have been called for rate limiting
    const rateLimitCalls = setTimeoutSpy.mock.calls.filter(
      ([, ms]) => typeof ms === "number" && ms > 0,
    );
    expect(rateLimitCalls).toHaveLength(0);
  });

  it("waits when requests arrive too quickly", async () => {
    // Last request was just now — must wait ~250ms
    __testing.setLastRequestTime(Date.now());
    stubFetchSequence(mockResponse([]));

    let resolved = false;
    const promise = fetchGames("fields id;").then((r) => {
      resolved = true;
      return r;
    });

    // Not resolved immediately
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Advance timers past the rate limit interval
    await vi.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS + 10);
    await promise;

    expect(resolved).toBe(true);
  });
});
