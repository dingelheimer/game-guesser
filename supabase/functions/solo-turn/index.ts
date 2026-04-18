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
import { processTurn, processHigherLowerTurn, applyDrawTimeSwap } from "./logic/turn.ts";
import { createSoloTurnDbOperations } from "./logic/db.ts";
import type { SessionUpdate } from "./logic/db.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  // Parse and validate request body
  let sessionId: string;
  let position: number | undefined;
  let guess: "higher" | "lower" | undefined;
  let variant: string | undefined;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sid = body["session_id"];

    if (typeof sid !== "string" || sid.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: session_id (string)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }
    sessionId = sid;

    const v = body["variant"];
    if (typeof v === "string") variant = v;

    if (variant === "higher_lower") {
      const g = body["guess"];
      if (g !== "higher" && g !== "lower") {
        return new Response(
          JSON.stringify({
            error: 'Missing required parameter: guess must be "higher" or "lower" for higher_lower variant',
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
        );
      }
      guess = g;
    } else {
      const pos = body["position"];
      if (typeof pos !== "number" || !Number.isInteger(pos) || pos < 0) {
        return new Response(
          JSON.stringify({
            error: "Missing required parameter: position (non-negative integer)",
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
        );
      }
      position = pos;
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
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
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
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
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (session.deck.length === 0) {
      return new Response(JSON.stringify({ error: "Session deck is empty — no card to place" }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const currentGameId = session.deck[0]!;
    const newYear = await db.fetchReleaseYear(currentGameId);

    // ── Higher Lower variant ────────────────────────────────────────────────
    if (variant === "higher_lower") {
      const referenceEntry = session.timeline[0];
      if (referenceEntry === undefined) {
        throw new Error("Higher Lower session has no reference card in timeline");
      }
      const referenceYear = referenceEntry.release_year;

      const result = processHigherLowerTurn(
        {
          score: session.score,
          turns_played: session.turns_played,
          current_streak: session.current_streak,
          best_streak: session.best_streak,
          deck: session.deck,
          timeline: session.timeline,
        },
        referenceYear,
        newYear,
        guess!,
      );

      // Apply draw-time swap to prevent same-year draws on the next turn.
      let finalDeck = result.new_deck;
      let allSameYearWin = false;
      if (result.correct && finalDeck.length > 0) {
        const deckYears = await db.fetchReleaseYears(finalDeck);
        const swapped = applyDrawTimeSwap(finalDeck, deckYears, newYear);
        if (swapped === null) {
          allSameYearWin = true;
          finalDeck = [];
        } else {
          finalDeck = swapped;
        }
      }

      const isGameOver = result.game_over || allSameYearWin;
      const update: SessionUpdate = {
        status: isGameOver ? "game_over" : "active",
        score: result.new_score,
        turns_played: result.new_turns_played,
        best_streak: result.new_best_streak,
        current_streak: result.new_current_streak,
        deck: finalDeck,
        timeline: result.new_timeline,
      };

      if (!result.correct) {
        update.failed_game_id = currentGameId;
      }

      await db.saveSession(sessionId, update);

      const revealedCard = await db.fetchRevealedCardData(currentGameId);
      let nextCard = null;
      if (!isGameOver && finalDeck.length > 0) {
        nextCard = await db.fetchHiddenCardData(finalDeck[0]!);
      }

      return new Response(
        JSON.stringify({
          correct: result.correct,
          revealed_card: revealedCard,
          score: result.new_score,
          turns_played: result.new_turns_played,
          current_streak: result.new_current_streak,
          best_streak: result.new_best_streak,
          game_over: isGameOver,
          ...(nextCard !== null && { next_card: nextCard }),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    // ── Standard / PRO / EXPERT path ───────────────────────────────────────
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
      position!,
    );

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

    const revealedCard = await db.fetchRevealedCardData(currentGameId);

    // Fetch platform bonus options (correct placement only; not for "standard").
    let platformOptions: { id: number; name: string }[] | undefined;
    let correctPlatformIds: number[] | undefined;
    if (result.correct && variant !== "standard") {
      const platformData = await db.fetchPlatformOptions(currentGameId, newYear);
      platformOptions = platformData.options;
      correctPlatformIds = platformData.correctIds;
    }

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
        ...(platformOptions !== undefined && { platform_options: platformOptions }),
        ...(correctPlatformIds !== undefined && { correct_platform_ids: correctPlatformIds }),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
