/**
 * daily-turn — Supabase Edge Function
 *
 * Processes one card placement in a daily challenge session.
 * Validates the position, applies the extra-try mechanic, and persists
 * the updated result. Returns the revealed card data and (if the game
 * continues) the next hidden card.
 *
 * Extra-try mechanic:
 *   - First wrong placement: card discarded, extra_try_used → true, game continues.
 *   - Second wrong placement: game over immediately.
 *
 * Invoke via CLI:
 *   supabase functions invoke daily-turn \
 *     --body '{"result_id":1,"position":2}'
 *   supabase functions invoke daily-turn \
 *     --body '{"result_id":1,"position":2,"anonymous_id":"<uuid>"}'
 *
 * Required env vars (auto-injected by Supabase Edge Functions runtime):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { createDailyTurnDbOperations } from "./logic/db.ts";
import { getCurrentCardDeckIndex, TOTAL_PLACEMENT_CARDS } from "./logic/turn.ts";
import { processDailyTurn } from "./logic/turn.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  result_id: z.number().int().positive(),
  position: z.number().int().min(0),
  anonymous_id: z.string().uuid().optional(),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // Parse and validate request body.
  let resultId: number;
  let position: number;
  let anonymousId: string | undefined;
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request body", details: parsed.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }
    resultId = parsed.data.result_id;
    position = parsed.data.position;
    anonymousId = parsed.data.anonymous_id;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // Validate Supabase environment.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(
      JSON.stringify({ error: "Required Supabase environment variables are not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  // Resolve identity: try JWT auth first, fall back to anonymous_id.
  let userId: string | undefined;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data } = await userClient.auth.getUser();
    if (data.user !== null) {
      userId = data.user.id;
    }
  }

  // Must have at least one identity.
  if (userId === undefined && anonymousId === undefined) {
    return new Response(
      JSON.stringify({
        error:
          "Identity required: provide a valid Authorization bearer token or an anonymous_id in the request body",
      }),
      { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const db = createDailyTurnDbOperations(supabase);

  try {
    // 1. Load result (verifies identity ownership).
    const result = await db.loadResult(resultId, userId, anonymousId);

    // 2. Guard: reject already-completed results.
    if (result.completed) {
      return new Response(
        JSON.stringify({ error: "Challenge already completed — no further turns allowed" }),
        { status: 409, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    // 3. Guard: reject out-of-order turns.
    if (result.turns_played >= TOTAL_PLACEMENT_CARDS) {
      return new Response(
        JSON.stringify({
          error: "All placement cards have been used — no further turns allowed",
        }),
        { status: 409, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    // 4. Load the challenge deck to determine the current card.
    const challenge = await db.loadChallenge(result.challenge_id);
    const cardDeckIndex = getCurrentCardDeckIndex(result.turns_played);
    const currentGameId = challenge.deck[cardDeckIndex];

    if (currentGameId === undefined) {
      throw new Error(
        `Deck index ${cardDeckIndex.toString()} out of range for deck of length ${challenge.deck.length.toString()}`,
      );
    }

    // 5. Fetch the release year (server-side only — never sent to the client before reveal).
    const cardYear = await db.fetchReleaseYear(currentGameId);

    // 6. Process the turn with pure logic.
    const turnResult = processDailyTurn(
      {
        score: result.score,
        turns_played: result.turns_played,
        extra_try_used: result.extra_try_used,
        timeline: result.timeline,
        placements: result.placements,
      },
      currentGameId,
      cardYear,
      position,
    );

    // 7. Persist the updated result.
    const update = {
      score: turnResult.new_score,
      turns_played: turnResult.new_turns_played,
      extra_try_used: turnResult.new_extra_try_used,
      timeline: turnResult.new_timeline,
      placements: turnResult.new_placements,
      completed: turnResult.game_over,
      ...(turnResult.game_over && { completed_at: new Date().toISOString() }),
    };
    await db.updateResult(resultId, update);

    // 8. Fetch revealed card and (if game continues) next hidden card in parallel.
    const nextDeckIndex = getCurrentCardDeckIndex(turnResult.new_turns_played);
    const nextGameId =
      !turnResult.game_over && nextDeckIndex <= TOTAL_PLACEMENT_CARDS
        ? challenge.deck[nextDeckIndex]
        : undefined;

    const [revealedCard, nextCard] = await Promise.all([
      db.fetchRevealedCardData(currentGameId),
      nextGameId !== undefined ? db.fetchHiddenCardData(nextGameId) : Promise.resolve(null),
    ]);

    return new Response(
      JSON.stringify({
        correct: turnResult.correct,
        revealed_card: revealedCard,
        score: turnResult.new_score,
        turns_played: turnResult.new_turns_played,
        extra_try_available: !turnResult.new_extra_try_used,
        game_over: turnResult.game_over,
        ...(nextCard !== null && { next_card: nextCard }),
        ...(turnResult.valid_positions !== undefined && {
          valid_positions: turnResult.valid_positions,
        }),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily-turn] error:", message);

    // Surface identity/auth errors as 403.
    if (message.startsWith("Unauthorized:")) {
      return new Response(JSON.stringify({ error: message }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    // Surface not-found errors as 404.
    if (message.endsWith("not found")) {
      return new Response(JSON.stringify({ error: message }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
