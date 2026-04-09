/**
 * import-games — Supabase Edge Function
 *
 * Imports games from the IGDB API into the Supabase database.
 * Processes one year at a time with full pagination support.
 *
 * Invoke via CLI:
 *   supabase functions invoke import-games \
 *     --body '{"start_year":2020,"end_year":2020,"min_rating_count":5}'
 *
 * Required secrets (set via `supabase secrets set`):
 *   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
 *
 * Auto-injected by the Supabase Edge Functions runtime:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { createDbOperations } from "./logic/db.ts";
import { importGames } from "./logic/importer.ts";
import type { ImportParams } from "./logic/importer.ts";
import type { IgdbGameInput } from "./logic/transform.ts";

// ---------------------------------------------------------------------------
// IGDB client (Deno-compatible, mirrors src/lib/igdb/client.ts logic)
// ---------------------------------------------------------------------------

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE_URL = "https://api.igdb.com/v4";
const MIN_REQUEST_INTERVAL_MS = 250; // 4 req/s

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let _cachedToken: CachedToken | null = null;
let _lastRequestTime = 0;

async function getAccessToken(): Promise<string> {
  if (_cachedToken !== null && Date.now() < _cachedToken.expiresAt) {
    return _cachedToken.accessToken;
  }

  const clientId = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    throw new Error(
      "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET secrets must be configured",
    );
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(url.toString(), { method: "POST" });
  if (!response.ok) {
    throw new Error(`Twitch auth failed with status ${String(response.status)}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  _cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return _cachedToken.accessToken;
}

async function throttle(): Promise<void> {
  const waitMs = MIN_REQUEST_INTERVAL_MS - (Date.now() - _lastRequestTime);
  if (waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  _lastRequestTime = Date.now();
}

async function igdbFetchGames(query: string): Promise<IgdbGameInput[]> {
  await throttle();

  const clientId = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
  const token = await getAccessToken();

  const doRequest = async (accessToken: string): Promise<Response> =>
    fetch(`${IGDB_BASE_URL}/games`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body: query,
    });

  let response = await doRequest(token);

  // Auto-refresh on 401 (expired token)
  if (response.status === 401) {
    _cachedToken = null;
    const refreshed = await getAccessToken();
    response = await doRequest(refreshed);
  }

  if (!response.ok) {
    throw new Error(
      `IGDB API error: ${String(response.status)} ${response.statusText}`,
    );
  }

  return (await response.json()) as IgdbGameInput[];
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse and validate request body
  let params: ImportParams;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const startYear = body["start_year"];
    const endYear = body["end_year"];
    const minRatingCount = body["min_rating_count"] ?? 5;

    if (typeof startYear !== "number" || typeof endYear !== "number") {
      return new Response(
        JSON.stringify({
          error:
            "Missing required parameters: start_year (number), end_year (number)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (startYear > endYear) {
      return new Response(
        JSON.stringify({ error: "start_year must be <= end_year" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    params = {
      start_year: startYear,
      end_year: endYear,
      min_rating_count: typeof minRatingCount === "number" ? minRatingCount : 5,
      resume: body["resume"] !== false,
    };
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate Supabase environment
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({
        error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const db = createDbOperations(supabase);

  try {
    const result = await importGames(params, igdbFetchGames, db);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
