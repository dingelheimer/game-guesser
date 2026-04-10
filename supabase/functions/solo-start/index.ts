/**
 * solo-start — Supabase Edge Function
 *
 * Creates a new solo game session and returns the anchor card (revealed)
 * and the first card to place (hidden — screenshot only).
 *
 * Invoke via CLI:
 *   supabase functions invoke solo-start \
 *     --body '{"difficulty":"easy"}'
 *
 * Required env vars (auto-injected by Supabase Edge Functions runtime):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildInitialSession } from "./logic/session.ts";
import { createSoloStartDbOperations } from "./logic/db.ts";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard", "extreme"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse and validate request body
  let difficulty: string;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const d = body["difficulty"];
    if (typeof d !== "string" || !VALID_DIFFICULTIES.has(d)) {
      return new Response(
        JSON.stringify({
          error:
            'Missing or invalid parameter: difficulty must be "easy", "medium", "hard", or "extreme"',
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    difficulty = d;
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
  const db = createSoloStartDbOperations(supabase);

  try {
    // 1. Fetch eligible games for the selected difficulty
    const eligibleGames = await db.fetchEligibleGames(difficulty);

    if (eligibleGames.length < 2) {
      return new Response(
        JSON.stringify({
          error: `Not enough games in the "${difficulty}" pool (found ${eligibleGames.length.toString()}, need at least 2)`,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Build shuffled deck with anchor
    const initialState = buildInitialSession(eligibleGames);

    // 3. Persist session
    const sessionId = await db.createSession(
      difficulty,
      initialState,
      initialState.anchor.release_year,
    );

    // 4. Fetch card data to return
    const [anchorCard, currentCard] = await Promise.all([
      db.fetchRevealedCardData(initialState.anchor.id),
      db.fetchHiddenCardData(initialState.deck[0]!),
    ]);

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        difficulty,
        score: 0,
        timeline: [anchorCard],
        current_card: currentCard,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
