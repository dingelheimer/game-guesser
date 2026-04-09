/**
 * solo-score — Supabase Edge Function
 *
 * Returns the final score and statistics for a solo game session.
 * Works for both active and completed (game_over) sessions.
 *
 * Invoke via CLI:
 *   supabase functions invoke solo-score \
 *     --body '{"session_id":"<uuid>"}'
 *
 * Required env vars (auto-injected by Supabase Edge Functions runtime):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse and validate request body
  let sessionId: string;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sid = body["session_id"];

    if (typeof sid !== "string" || sid.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: session_id (string)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    sessionId = sid;
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

  try {
    const { data, error } = await supabase
      .from("solo_sessions")
      .select(
        "id, difficulty, status, score, turns_played, best_streak, current_streak, failed_game_id, failed_position",
      )
      .eq("id", sessionId)
      .single();

    if (error !== null || data === null) {
      return new Response(
        JSON.stringify({
          error: `Session not found: ${error?.message ?? "no data"}`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(data), {
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
