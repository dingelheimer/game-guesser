/**
 * Database operations for the daily-start Edge Function.
 * Wraps Supabase client calls; injected into the handler for testability.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  computeChallengeNumber,
  seededShuffle,
  utcDateString,
} from "../../_shared/seeded-shuffle.ts";
import { getDisplayName } from "../../solo-turn/logic/platform-names.ts";
import type { TimelineEntry, PlacementRecord } from "./start.ts";
import { DECK_SIZE } from "./start.ts";

/** Medium difficulty max rank (mirrors daily-generate). */
const MEDIUM_MAX_RANK = 5;

/** A row from the daily_challenges table. */
export interface DailyChallengeRow {
  id: number;
  challenge_number: number;
  challenge_date: string;
  deck: number[];
  difficulty: string;
  variant: string;
}

/** A row from the daily_challenge_results table. */
export interface DailyResultRow {
  id: number;
  challenge_id: number;
  user_id: string | null;
  anonymous_id: string | null;
  score: number;
  turns_played: number;
  extra_try_used: boolean;
  placements: PlacementRecord[];
  completed: boolean;
  timeline: TimelineEntry[];
}

/** Full game data returned for a revealed card. */
export interface RevealedCardData {
  game_id: number;
  name: string;
  release_year: number;
  cover_image_id: string;
  screenshot_image_ids: string[];
  platform_names: string[];
}

/** Minimal card data returned for a hidden (yet-to-be-placed) card. */
export interface HiddenCardData {
  game_id: number;
  screenshot_image_ids: string[];
}

/** All DB operation signatures for daily-start. */
export interface DailyStartDbOperations {
  fetchTodayChallenge: () => Promise<DailyChallengeRow | null>;
  generateChallengeOnDemand: (
    dateStr: string,
    challengeNumber: number,
  ) => Promise<DailyChallengeRow>;
  findExistingResult: (
    challengeId: number,
    userId: string | undefined,
    anonymousId: string | undefined,
  ) => Promise<DailyResultRow | null>;
  createResult: (
    challengeId: number,
    userId: string | undefined,
    anonymousId: string | undefined,
    initialTimeline: TimelineEntry[],
  ) => Promise<DailyResultRow>;
  fetchRevealedCardData: (gameId: number) => Promise<RevealedCardData>;
  fetchHiddenCardData: (gameId: number) => Promise<HiddenCardData>;
}

export function createDailyStartDbOperations(
  supabase: SupabaseClient,
  launchDate: string,
): DailyStartDbOperations {
  return {
    async fetchTodayChallenge(): Promise<DailyChallengeRow | null> {
      const today = utcDateString();
      const { data, error } = await supabase
        .from("daily_challenges")
        .select("id, challenge_number, challenge_date, deck, difficulty, variant")
        .eq("challenge_date", today)
        .maybeSingle();

      if (error !== null) {
        throw new Error(`Failed to fetch today's challenge: ${error.message}`);
      }
      return data as DailyChallengeRow | null;
    },

    async generateChallengeOnDemand(
      dateStr: string,
      challengeNumber: number,
    ): Promise<DailyChallengeRow> {
      console.warn(`[daily-start] Fallback generation triggered for ${dateStr} — cron may have missed`);

      const { data: gameRows, error: gameIdsError } = await supabase.rpc(
        "get_daily_eligible_game_ids",
        { p_max_rank: MEDIUM_MAX_RANK },
      );

      if (gameIdsError !== null) {
        throw new Error(`Fallback: failed to fetch eligible game IDs: ${gameIdsError.message}`);
      }

      const ids = (gameRows as { id: number }[]).map((r) => r.id);

      if (ids.length < DECK_SIZE) {
        throw new Error(
          `Fallback: not enough eligible games (found ${ids.length.toString()}, need ${DECK_SIZE.toString()})`,
        );
      }

      const deck = seededShuffle(ids, challengeNumber).slice(0, DECK_SIZE);

      const { error: insertError } = await supabase.from("daily_challenges").insert({
        challenge_number: challengeNumber,
        challenge_date: dateStr,
        deck,
        difficulty: "medium",
        variant: "standard",
      });

      // If a concurrent request inserted the same row, fetch it instead.
      if (insertError !== null) {
        if (insertError.code === "23505") {
          const { data: existing, error: fetchErr } = await supabase
            .from("daily_challenges")
            .select("id, challenge_number, challenge_date, deck, difficulty, variant")
            .eq("challenge_date", dateStr)
            .single();

          if (fetchErr !== null || existing === null) {
            throw new Error(`Fallback: race condition — could not re-fetch challenge: ${fetchErr?.message ?? "no data"}`);
          }
          return existing as DailyChallengeRow;
        }
        throw new Error(`Fallback: failed to insert challenge for ${dateStr}: ${insertError.message}`);
      }

      // Fetch the newly inserted row to get its id.
      const { data: inserted, error: fetchInsertedErr } = await supabase
        .from("daily_challenges")
        .select("id, challenge_number, challenge_date, deck, difficulty, variant")
        .eq("challenge_date", dateStr)
        .single();

      if (fetchInsertedErr !== null || inserted === null) {
        throw new Error(`Fallback: failed to fetch inserted challenge: ${fetchInsertedErr?.message ?? "no data"}`);
      }

      return inserted as DailyChallengeRow;
    },

    async findExistingResult(
      challengeId: number,
      userId: string | undefined,
      anonymousId: string | undefined,
    ): Promise<DailyResultRow | null> {
      let query = supabase
        .from("daily_challenge_results")
        .select(
          "id, challenge_id, user_id, anonymous_id, score, turns_played, extra_try_used, placements, completed, timeline",
        )
        .eq("challenge_id", challengeId);

      if (userId !== undefined) {
        query = query.eq("user_id", userId);
      } else if (anonymousId !== undefined) {
        query = query.eq("anonymous_id", anonymousId);
      } else {
        throw new Error("findExistingResult: must supply userId or anonymousId");
      }

      const { data, error } = await query.maybeSingle();

      if (error !== null) {
        throw new Error(`Failed to query daily result: ${error.message}`);
      }

      return data as DailyResultRow | null;
    },

    async createResult(
      challengeId: number,
      userId: string | undefined,
      anonymousId: string | undefined,
      initialTimeline: TimelineEntry[],
    ): Promise<DailyResultRow> {
      const row: Record<string, unknown> = {
        challenge_id: challengeId,
        score: 0,
        turns_played: 0,
        extra_try_used: false,
        placements: [],
        completed: false,
        timeline: initialTimeline,
      };

      if (userId !== undefined) {
        row["user_id"] = userId;
      } else if (anonymousId !== undefined) {
        row["anonymous_id"] = anonymousId;
      }

      const { data, error } = await supabase
        .from("daily_challenge_results")
        .insert(row)
        .select(
          "id, challenge_id, user_id, anonymous_id, score, turns_played, extra_try_used, placements, completed, timeline",
        )
        .single();

      if (error !== null || data === null) {
        throw new Error(`Failed to create daily result: ${error?.message ?? "no data"}`);
      }

      return data as DailyResultRow;
    },

    async fetchRevealedCardData(gameId: number): Promise<RevealedCardData> {
      const { data: game, error: gameErr } = await supabase
        .from("games")
        .select("id, name, release_year")
        .eq("id", gameId)
        .single();

      if (gameErr !== null || game === null) {
        throw new Error(
          `Failed to fetch game ${gameId.toString()}: ${gameErr?.message ?? "not found"}`,
        );
      }

      const { data: cover, error: coverErr } = await supabase
        .from("covers")
        .select("igdb_image_id")
        .eq("game_id", gameId)
        .single();

      if (coverErr !== null || cover === null) {
        throw new Error(
          `Failed to fetch cover for game ${gameId.toString()}: ${coverErr?.message ?? "not found"}`,
        );
      }

      const { data: screenshots, error: screenshotErr } = await supabase
        .from("screenshots")
        .select("igdb_image_id")
        .eq("game_id", gameId)
        .neq("curation", "rejected")
        .order("sort_order")
        .limit(3);

      if (screenshotErr !== null) {
        throw new Error(
          `Failed to fetch screenshots for game ${gameId.toString()}: ${screenshotErr.message}`,
        );
      }

      const { data: platforms, error: platformErr } = await supabase
        .from("game_platforms")
        .select("platforms(name)")
        .eq("game_id", gameId);

      if (platformErr !== null) {
        throw new Error(
          `Failed to fetch platforms for game ${gameId.toString()}: ${platformErr.message}`,
        );
      }

      const platformNames = (platforms ?? []).flatMap((row) => {
        const p = row.platforms as { name: string } | null;
        return p !== null ? [getDisplayName(p.name)] : [];
      });

      return {
        game_id: game.id as number,
        name: game.name as string,
        release_year: game.release_year as number,
        cover_image_id: cover.igdb_image_id as string,
        screenshot_image_ids: (screenshots ?? []).map((s) => s.igdb_image_id as string),
        platform_names: platformNames,
      };
    },

    async fetchHiddenCardData(gameId: number): Promise<HiddenCardData> {
      const { data: screenshots, error } = await supabase
        .from("screenshots")
        .select("igdb_image_id")
        .eq("game_id", gameId)
        .neq("curation", "rejected")
        .order("sort_order")
        .limit(3);

      if (error !== null) {
        throw new Error(
          `Failed to fetch screenshots for game ${gameId.toString()}: ${error.message}`,
        );
      }

      return {
        game_id: gameId,
        screenshot_image_ids: (screenshots ?? []).map((s) => s.igdb_image_id as string),
      };
    },
  };
}
