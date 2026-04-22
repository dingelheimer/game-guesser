/**
 * daily-start — Supabase Edge Function
 *
 * Starts, resumes, or returns the completed result of today's daily challenge.
 *
 * Three outcomes based on the player's existing state:
 *   - "started"     — no prior attempt; creates a new result row
 *   - "in_progress" — attempt exists but not yet completed; returns resume state
 *   - "completed"   — attempt already completed; returns the final result
 *
 * Identity resolution (in priority order):
 *   1. Authenticated user  — derived from the Authorization bearer JWT
 *   2. Guest player        — anonymous_id UUID supplied in the request body
 *
 * Invoke via CLI:
 *   supabase functions invoke daily-start \
 *     --body '{}'
 *   supabase functions invoke daily-start \
 *     --body '{"anonymous_id":"<uuid>"}'
 *
 * Required env vars (auto-injected by Supabase Edge Functions runtime):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env vars:
 *   DAILY_LAUNCH_DATE — ISO date of challenge #1 (default: "2026-04-22")
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { computeChallengeNumber, utcDateString } from "../_shared/seeded-shuffle.ts";
import { createDailyStartDbOperations } from "./logic/db.ts";
import { getCurrentCardDeckIndex, isInProgress, TOTAL_PLACEMENT_CARDS } from "./logic/start.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
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

  const launchDate = Deno.env.get("DAILY_LAUNCH_DATE") ?? "2026-04-22";
  const supabase = createClient(supabaseUrl, serviceKey);
  const db = createDailyStartDbOperations(supabase, launchDate);

  try {
    // 1. Fetch today's challenge; generate on demand if the cron missed.
    let challenge = await db.fetchTodayChallenge();
    if (challenge === null) {
      const today = utcDateString();
      const challengeNumber = computeChallengeNumber(launchDate, today);
      if (challengeNumber < 1) {
        return new Response(
          JSON.stringify({ error: "No daily challenge available yet — launch date not reached" }),
          { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
        );
      }
      challenge = await db.generateChallengeOnDemand(today, challengeNumber);
    }

    // 2. Look for an existing result row for this player.
    // For authenticated users, also fetch streak data in parallel.
    const [existingResult, streakRow] = await Promise.all([
      db.findExistingResult(challenge.id, userId, anonymousId),
      userId !== undefined ? db.fetchStreak(userId) : Promise.resolve(null),
    ]);

    const streakData =
      userId !== undefined && streakRow !== null
        ? { current_streak: streakRow.current_streak, best_streak: streakRow.best_streak }
        : null;

    // ── Completed ─────────────────────────────────────────────────────────
    if (existingResult !== null && existingResult.completed) {
      return new Response(
        JSON.stringify({
          status: "completed",
          result_id: existingResult.id,
          challenge_number: challenge.challenge_number,
          challenge_date: challenge.challenge_date,
          score: existingResult.score,
          turns_played: existingResult.turns_played,
          extra_try_used: existingResult.extra_try_used,
          placements: existingResult.placements,
          timeline: existingResult.timeline,
          total_cards: TOTAL_PLACEMENT_CARDS,
          streak: streakData,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    // ── In Progress (resume) ──────────────────────────────────────────────
    if (
      existingResult !== null &&
      isInProgress(existingResult.turns_played, existingResult.completed)
    ) {
      const currentDeckIdx = getCurrentCardDeckIndex(existingResult.turns_played);
      const currentGameId = challenge.deck[currentDeckIdx];

      if (currentGameId === undefined) {
        throw new Error(
          `In-progress state corrupt: deck index ${currentDeckIdx.toString()} out of range for deck of ${challenge.deck.length.toString()}`,
        );
      }

      const [anchorCard, currentCard] = await Promise.all([
        db.fetchRevealedCardData(challenge.deck[0]!),
        db.fetchHiddenCardData(currentGameId),
      ]);

      return new Response(
        JSON.stringify({
          status: "in_progress",
          result_id: existingResult.id,
          challenge_number: challenge.challenge_number,
          challenge_date: challenge.challenge_date,
          anchor_card: anchorCard,
          current_card: currentCard,
          timeline: existingResult.timeline,
          score: existingResult.score,
          turns_played: existingResult.turns_played,
          extra_try_used: existingResult.extra_try_used,
          extra_try_available: !existingResult.extra_try_used,
          placements: existingResult.placements,
          total_cards: TOTAL_PLACEMENT_CARDS,
          streak: streakData,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    // ── New Game (started) ────────────────────────────────────────────────
    const anchorGameId = challenge.deck[0];
    const firstCardGameId = challenge.deck[1];

    if (anchorGameId === undefined || firstCardGameId === undefined) {
      throw new Error("Challenge deck has fewer than 2 entries — data integrity error");
    }

    // Fetch anchor release year to build the initial timeline.
    const anchorCard = await db.fetchRevealedCardData(anchorGameId);
    const initialTimeline = [{ game_id: anchorGameId, release_year: anchorCard.release_year }];

    const [newResult, firstCard] = await Promise.all([
      db.createResult(challenge.id, userId, anonymousId, initialTimeline),
      db.fetchHiddenCardData(firstCardGameId),
    ]);

    return new Response(
      JSON.stringify({
        status: "started",
        result_id: newResult.id,
        challenge_number: challenge.challenge_number,
        challenge_date: challenge.challenge_date,
        anchor_card: anchorCard,
        current_card: firstCard,
        timeline: initialTimeline,
        score: 0,
        turns_played: 0,
        extra_try_used: false,
        extra_try_available: true,
        placements: [],
        total_cards: TOTAL_PLACEMENT_CARDS,
        streak: streakData,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily-start] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
