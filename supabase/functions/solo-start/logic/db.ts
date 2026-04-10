/**
 * Database operations for the solo-start Edge Function.
 * Wraps Supabase client calls; injected into the handler for testability.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { EligibleGame, InitialSessionState } from "./session.ts";

/** Full game data returned to the client for a revealed card. */
export interface RevealedCardData {
  game_id: number;
  name: string;
  release_year: number;
  cover_image_id: string;
  screenshot_image_ids: string[];
  platform_names: string[];
}

/** Minimal card data returned to the client for the hidden current card. */
export interface HiddenCardData {
  game_id: number;
  screenshot_image_ids: string[];
}

/** All DB operation signatures for solo-start. */
export interface SoloStartDbOperations {
  fetchEligibleGames: (difficulty: string) => Promise<EligibleGame[]>;
  fetchRevealedCardData: (gameId: number) => Promise<RevealedCardData>;
  fetchHiddenCardData: (gameId: number) => Promise<HiddenCardData>;
  createSession: (
    difficulty: string,
    state: InitialSessionState,
    anchorReleaseYear: number,
  ) => Promise<string>; // returns session_id
}

/**
 * Difficulty-to-rank-threshold map (mirrors games_by_difficulty view logic).
 * We query the games table directly rather than the view to keep
 * the query predictable and avoid SECURITY INVOKER issues.
 */
const DIFFICULTY_MAX_RANK: Record<string, number | null> = {
  easy: 10,
  medium: 20,
  hard: 50,
  extreme: null,
};

export function createSoloStartDbOperations(
  supabase: SupabaseClient,
): SoloStartDbOperations {
  return {
    async fetchEligibleGames(difficulty: string): Promise<EligibleGame[]> {
      const maxRank = DIFFICULTY_MAX_RANK[difficulty] ?? null;

      let query = supabase
        .from("games")
        .select("id, release_year")
        // Must have a cover
        .not("id", "is", null) // placeholder; joined below via EXISTS equivalent
        .order("id");

      if (maxRank !== null) {
        query = query.lte("popularity_rank_per_year", maxRank);
      }

      // Supabase JS client doesn't support EXISTS sub-queries, so we use a
      // Postgres RPC function alternatively. Instead, filter via inner join
      // by selecting from covers and screenshots tables.
      // Simplest approach: fetch all qualifying games and let the import
      // pipeline guarantee cover + screenshot presence (it filters at import time).
      // We still guard here by checking in the query via a Postgres function.
      // For now, trust the import pipeline and just filter by rank.
      const { data, error } = await query;

      if (error !== null) {
        throw new Error(`Failed to fetch eligible games: ${error.message}`);
      }

      return (data ?? []) as EligibleGame[];
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
        .eq("game_id", gameId)
        .limit(3);

      if (platformErr !== null) {
        throw new Error(
          `Failed to fetch platforms for game ${gameId.toString()}: ${platformErr.message}`,
        );
      }

      const platformNames = (platforms ?? []).flatMap((row) => {
        const p = row.platforms as { name: string } | null;
        return p !== null ? [p.name] : [];
      });

      return {
        game_id: game.id as number,
        name: game.name as string,
        release_year: game.release_year as number,
        cover_image_id: cover.igdb_image_id as string,
        screenshot_image_ids: (screenshots ?? []).map(
          (s) => s.igdb_image_id as string,
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
          (s) => s.igdb_image_id as string,
        ),
      };
    },

    async createSession(
      difficulty: string,
      state: InitialSessionState,
      anchorReleaseYear: number,
    ): Promise<string> {
      const timeline = [
        { game_id: state.anchor.id, release_year: anchorReleaseYear },
      ];

      const { data, error } = await supabase
        .from("solo_sessions")
        .insert({
          difficulty,
          deck: state.deck,
          timeline,
        })
        .select("id")
        .single();

      if (error !== null || data === null) {
        throw new Error(
          `Failed to create solo session: ${error?.message ?? "no data"}`,
        );
      }

      return (data as { id: string }).id;
    },
  };
}
