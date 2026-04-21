/**
 * Database operations for the daily-turn Edge Function.
 * Wraps Supabase client calls; injected into the handler for testability.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getDisplayName } from "../../solo-turn/logic/platform-names.ts";
import type { PlacementRecord, TimelineEntry } from "./turn.ts";

/** A row from daily_challenge_results (fields needed by daily-turn). */
export interface DailyResultSnapshot {
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

/** Minimal challenge data needed to resolve the current card. */
export interface DailyChallengeRow {
  id: number;
  deck: number[];
}

/** Fields to write back to daily_challenge_results after a turn. */
export interface DailyResultUpdate {
  score: number;
  turns_played: number;
  extra_try_used: boolean;
  timeline: TimelineEntry[];
  placements: PlacementRecord[];
  completed: boolean;
  completed_at?: string;
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

/** All DB operation signatures for daily-turn. */
export interface DailyTurnDbOperations {
  /**
   * Load the result row, verifying the caller's identity.
   * Throws if not found or identity does not match.
   */
  loadResult: (
    resultId: number,
    userId: string | undefined,
    anonymousId: string | undefined,
  ) => Promise<DailyResultSnapshot>;

  /** Load the challenge deck for the given challenge ID. */
  loadChallenge: (challengeId: number) => Promise<DailyChallengeRow>;

  /** Fetch the release year of a game by ID. */
  fetchReleaseYear: (gameId: number) => Promise<number>;

  /** Persist the updated result fields after a turn. */
  updateResult: (resultId: number, update: DailyResultUpdate) => Promise<void>;

  /** Fetch full revealed card data (name, year, cover, screenshots, platforms). */
  fetchRevealedCardData: (gameId: number) => Promise<RevealedCardData>;

  /** Fetch hidden card data (screenshots only — no spoilers). */
  fetchHiddenCardData: (gameId: number) => Promise<HiddenCardData>;
}

/** Factory — creates DB operations bound to a Supabase client. */
export function createDailyTurnDbOperations(supabase: SupabaseClient): DailyTurnDbOperations {
  return {
    async loadResult(
      resultId: number,
      userId: string | undefined,
      anonymousId: string | undefined,
    ): Promise<DailyResultSnapshot> {
      const { data, error } = await supabase
        .from("daily_challenge_results")
        .select(
          "id, challenge_id, user_id, anonymous_id, score, turns_played, extra_try_used, placements, completed, timeline",
        )
        .eq("id", resultId)
        .maybeSingle();

      if (error !== null) {
        throw new Error(`Failed to load result ${resultId.toString()}: ${error.message}`);
      }
      if (data === null) {
        throw new Error(`Result ${resultId.toString()} not found`);
      }

      const row = data as DailyResultSnapshot;

      // Verify the caller owns this result row.
      if (userId !== undefined) {
        if (row.user_id !== userId) {
          throw new Error("Unauthorized: result does not belong to this user");
        }
      } else if (anonymousId !== undefined) {
        if (row.anonymous_id !== anonymousId) {
          throw new Error("Unauthorized: result does not belong to this anonymous_id");
        }
      } else {
        throw new Error("Identity required: must supply userId or anonymousId");
      }

      return row;
    },

    async loadChallenge(challengeId: number): Promise<DailyChallengeRow> {
      const { data, error } = await supabase
        .from("daily_challenges")
        .select("id, deck")
        .eq("id", challengeId)
        .single();

      if (error !== null || data === null) {
        throw new Error(
          `Failed to load challenge ${challengeId.toString()}: ${error?.message ?? "not found"}`,
        );
      }
      return data as DailyChallengeRow;
    },

    async fetchReleaseYear(gameId: number): Promise<number> {
      const { data, error } = await supabase
        .from("games")
        .select("release_year")
        .eq("id", gameId)
        .single();

      if (error !== null || data === null) {
        throw new Error(
          `Failed to fetch release year for game ${gameId.toString()}: ${error?.message ?? "not found"}`,
        );
      }
      return (data as { release_year: number }).release_year;
    },

    async updateResult(resultId: number, update: DailyResultUpdate): Promise<void> {
      const patch: Record<string, unknown> = {
        score: update.score,
        turns_played: update.turns_played,
        extra_try_used: update.extra_try_used,
        timeline: update.timeline,
        placements: update.placements,
        completed: update.completed,
      };
      if (update.completed_at !== undefined) {
        patch["completed_at"] = update.completed_at;
      }

      const { error } = await supabase
        .from("daily_challenge_results")
        .update(patch)
        .eq("id", resultId);

      if (error !== null) {
        throw new Error(`Failed to update result ${resultId.toString()}: ${error.message}`);
      }
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
        game_id: (game as { id: number }).id,
        name: (game as { name: string }).name,
        release_year: (game as { release_year: number }).release_year,
        cover_image_id: (cover as { igdb_image_id: string }).igdb_image_id,
        screenshot_image_ids: (screenshots ?? []).map(
          (s) => (s as { igdb_image_id: string }).igdb_image_id,
        ),
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
        screenshot_image_ids: (screenshots ?? []).map(
          (s) => (s as { igdb_image_id: string }).igdb_image_id,
        ),
      };
    },
  };
}
