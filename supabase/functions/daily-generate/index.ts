/**
 * daily-generate — Supabase Edge Function (scheduled cron)
 *
 * Generates the daily challenge for today and the next N days ahead as a
 * buffer. Designed to be invoked as a Supabase scheduled function at 00:00
 * UTC daily.
 *
 * Idempotent — skips any date that already has a row in `daily_challenges`.
 *
 * Cron setup (via Supabase Dashboard → Edge Functions → Schedules):
 *   Schedule: "0 0 * * *"  (every day at 00:00 UTC)
 *   Function: daily-generate
 *
 * Required env vars (auto-injected by Supabase Edge Functions runtime):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env vars:
 *   DAILY_LAUNCH_DATE  — ISO date string of challenge #1 (default: "2026-04-22")
 *   DAILY_ADVANCE_DAYS — how many days ahead to pre-generate (default: 7)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { computeChallengeNumber, seededShuffle, utcDateString } from "../_shared/seeded-shuffle.ts";

/** Medium difficulty: popularity_rank_per_year <= 5 */
const MEDIUM_MAX_RANK = 5;

/** Number of games per challenge (1 anchor + 10 placements). */
const DECK_SIZE = 11;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  const launchDate = Deno.env.get("DAILY_LAUNCH_DATE") ?? "2026-04-22";
  const advanceDays = parseInt(Deno.env.get("DAILY_ADVANCE_DAYS") ?? "7", 10);

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch eligible game IDs via the dedicated RPC (stable ORDER BY id).
    const { data: gameRows, error: gameIdsError } = await supabase.rpc(
      "get_daily_eligible_game_ids",
      { p_max_rank: MEDIUM_MAX_RANK },
    );

    if (gameIdsError !== null) {
      throw new Error(`Failed to fetch eligible game IDs: ${gameIdsError.message}`);
    }

    const ids = (gameRows as { id: number }[]).map((r) => r.id);

    if (ids.length < DECK_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Not enough eligible games (found ${ids.length.toString()}, need ${DECK_SIZE.toString()})`,
        }),
        { status: 503, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    // Generate challenges for today + advanceDays ahead.
    const today = new Date();
    const generated: string[] = [];
    const skipped: string[] = [];

    for (let dayOffset = 0; dayOffset < advanceDays; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setUTCDate(today.getUTCDate() + dayOffset);
      const dateStr = utcDateString(targetDate);
      const challengeNumber = computeChallengeNumber(launchDate, dateStr);

      // Idempotency: skip if already generated.
      const { data: existing } = await supabase
        .from("daily_challenges")
        .select("id")
        .eq("challenge_date", dateStr)
        .maybeSingle();

      if (existing !== null) {
        skipped.push(dateStr);
        continue;
      }

      // Skip pre-launch dates — challenge numbers ≤ 0 are not valid.
      if (challengeNumber < 1) {
        skipped.push(dateStr);
        continue;
      }

      const deck = seededShuffle(ids, challengeNumber).slice(0, DECK_SIZE);

      const { error: insertError } = await supabase.from("daily_challenges").insert({
        challenge_number: challengeNumber,
        challenge_date: dateStr,
        deck,
        difficulty: "medium",
        variant: "standard",
      });

      if (insertError !== null) {
        throw new Error(`Failed to insert challenge for ${dateStr}: ${insertError.message}`);
      }

      generated.push(dateStr);
    }

    return new Response(JSON.stringify({ generated, skipped }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily-generate] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
