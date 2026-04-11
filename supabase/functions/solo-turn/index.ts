/**
 * solo-turn — Supabase Edge Function
 *
 * Processes one placement turn in a solo game session.
 * Validates whether the card was placed in the correct chronological position,
 * updates session state, and returns the result with the next card (or game over).
 *
 * Invoke via CLI:
 *   supabase functions invoke solo-turn \
 *     --body '{"session_id":"<uuid>","position":2}'
 *
 * Required env vars (auto-injected by Supabase Edge Functions runtime):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { processTurn } from "./logic/turn.ts";
import { createSoloTurnDbOperations } from "./logic/db.ts";
import type { SessionUpdate } from "./logic/db.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse and validate request body
  let sessionId: string;
  let position: number;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sid = body["session_id"];
    const pos = body["position"];

    if (typeof sid !== "string" || sid.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: session_id (string)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (typeof pos !== "number" || !Number.isInteger(pos) || pos < 0) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameter: position (non-negative integer)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    sessionId = sid;
    position = pos;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
  const db = createSoloTurnDbOperations(supabase);

  try {
    // 1. Load session
    const session = await db.loadSession(sessionId);

    if (session.status !== "active") {
      return new Response(JSON.stringify({ error: "Session is not active" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (session.deck.length === 0) {
      return new Response(JSON.stringify({ error: "Session deck is empty — no card to place" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Get the release year for the current card
    const currentGameId = session.deck[0]!;
    const newYear = await db.fetchReleaseYear(currentGameId);

    // 3. Process the turn
    const result = processTurn(
      {
        score: session.score,
        turns_played: session.turns_played,
        current_streak: session.current_streak,
        best_streak: session.best_streak,
        deck: session.deck,
        timeline: session.timeline,
      },
      newYear,
      position,
    );

    // 4. Persist updated session
    const update: SessionUpdate = {
      status: result.game_over ? "game_over" : "active",
      score: result.new_score,
      turns_played: result.new_turns_played,
      best_streak: result.new_best_streak,
      current_streak: result.new_current_streak,
      deck: result.new_deck,
      timeline: result.new_timeline,
    };

    if (!result.correct) {
      update.failed_game_id = currentGameId;
      update.failed_position = position;
    }

    await db.saveSession(sessionId, update);

    // 5. Fetch revealed card data
    const revealedCard = await db.fetchRevealedCardData(currentGameId);

    // 6. Fetch next card (if game isn't over)
    let nextCard = null;
    if (!result.game_over) {
      const nextGameId = result.new_deck[0];
      if (nextGameId !== undefined) {
        nextCard = await db.fetchHiddenCardData(nextGameId);
      }
    }

    return new Response(
      JSON.stringify({
        correct: result.correct,
        revealed_card: revealedCard,
        score: result.new_score,
        turns_played: result.new_turns_played,
        current_streak: result.new_current_streak,
        best_streak: result.new_best_streak,
        game_over: result.game_over,
        ...(nextCard !== null && { next_card: nextCard }),
        ...(result.valid_positions !== undefined && {
          valid_positions: result.valid_positions,
        }),
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
