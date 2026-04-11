/**
 * IGDB API client.
 *
 * Handles Twitch OAuth2 authentication (client credentials flow), in-memory
 * token caching, rate limiting (4 req/s), and typed requests to IGDB endpoints.
 *
 * This module is server-side only — credentials are read from environment
 * variables and must never be exposed to the browser.
 */
import "server-only";

import type {
  IgdbCover,
  IgdbErrorCode,
  IgdbGame,
  IgdbGenre,
  IgdbPlatform,
  IgdbScreenshot,
  TwitchTokenResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE_URL = "https://api.igdb.com/v4";

/**
 * Minimum milliseconds between requests to stay within the 4 req/s limit.
 * 4 req/s → 250 ms per request.
 */
export const MIN_REQUEST_INTERVAL_MS = 250;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class IgdbError extends Error {
  constructor(
    public readonly code: IgdbErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "IgdbError";
  }
}

// ---------------------------------------------------------------------------
// Token cache (module-level, in-memory)
// ---------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  /** Epoch ms at which the token should be considered expired (with buffer). */
  expiresAt: number;
}

let _cachedToken: CachedToken | null = null;

// ---------------------------------------------------------------------------
// Rate limiter (module-level)
// ---------------------------------------------------------------------------

let _lastRequestTime = 0;

// ---------------------------------------------------------------------------
// Helpers — environment
// ---------------------------------------------------------------------------

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (
    clientId === undefined ||
    clientId === "" ||
    clientSecret === undefined ||
    clientSecret === ""
  ) {
    throw new IgdbError(
      "unauthorized",
      "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables must be set",
    );
  }

  return { clientId, clientSecret };
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

async function fetchNewToken(clientId: string, clientSecret: string): Promise<CachedToken> {
  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  let response: Response;
  try {
    response = await fetch(url.toString(), { method: "POST" });
  } catch (err) {
    throw new IgdbError(
      "network_error",
      `Twitch auth network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new IgdbError(
      "unauthorized",
      `Twitch auth failed with status ${String(response.status)}`,
      response.status,
    );
  }

  const data = (await response.json()) as TwitchTokenResponse;

  return {
    accessToken: data.access_token,
    // Subtract a 60-second buffer so we refresh before the token truly expires.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
}

async function getAccessToken(): Promise<string> {
  if (_cachedToken !== null && Date.now() < _cachedToken.expiresAt) {
    return _cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getCredentials();
  _cachedToken = await fetchNewToken(clientId, clientSecret);
  return _cachedToken.accessToken;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

async function throttle(): Promise<void> {
  const now = Date.now();
  const waitMs = MIN_REQUEST_INTERVAL_MS - (now - _lastRequestTime);
  if (waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  _lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

async function igdbRequest<T>(endpoint: string, query: string): Promise<T[]> {
  await throttle();

  const { clientId } = getCredentials();
  const token = await getAccessToken();

  const doFetch = async (accessToken: string): Promise<Response> => {
    try {
      return await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "text/plain",
          Accept: "application/json",
        },
        body: query,
      });
    } catch (err) {
      throw new IgdbError(
        "network_error",
        `IGDB network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  let response = await doFetch(token);

  // Auto-refresh token on 401 and retry once.
  if (response.status === 401) {
    _cachedToken = null;
    const refreshedToken = await getAccessToken();
    response = await doFetch(refreshedToken);
  }

  if (response.status === 429) {
    throw new IgdbError("rate_limit", "IGDB rate limit exceeded (429)", 429);
  }

  if (!response.ok) {
    throw new IgdbError(
      "api_error",
      `IGDB API error: ${String(response.status)} ${response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as T[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch games from IGDB.
 * Use {@link buildQuery} from `./apicalypse` to construct the query string.
 */
export async function fetchGames(query: string): Promise<IgdbGame[]> {
  return igdbRequest<IgdbGame>("games", query);
}

/** Fetch cover art records from IGDB. */
export async function fetchCovers(query: string): Promise<IgdbCover[]> {
  return igdbRequest<IgdbCover>("covers", query);
}

/** Fetch screenshot records from IGDB. */
export async function fetchScreenshots(query: string): Promise<IgdbScreenshot[]> {
  return igdbRequest<IgdbScreenshot>("screenshots", query);
}

/** Fetch platform records from IGDB. */
export async function fetchPlatforms(query: string): Promise<IgdbPlatform[]> {
  return igdbRequest<IgdbPlatform>("platforms", query);
}

/** Fetch genre records from IGDB. */
export async function fetchGenres(query: string): Promise<IgdbGenre[]> {
  return igdbRequest<IgdbGenre>("genres", query);
}

// ---------------------------------------------------------------------------
// Testing utilities (exported for unit tests only — do not use in production)
// ---------------------------------------------------------------------------

/** @internal */
export const __testing = {
  clearTokenCache() {
    _cachedToken = null;
  },
  setTokenCache(token: CachedToken) {
    _cachedToken = token;
  },
  setLastRequestTime(t: number) {
    _lastRequestTime = t;
  },
  getLastRequestTime() {
    return _lastRequestTime;
  },
  reset() {
    _cachedToken = null;
    _lastRequestTime = 0;
  },
};
