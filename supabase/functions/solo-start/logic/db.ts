/**
 * Database operations for the solo-start Edge Function.
 * Wraps Supabase client calls; injected into the handler for testability.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { EligibleGame, InitialSessionState } from "./session.ts";
import { getDisplayName } from "../../solo-turn/logic/platform-names.ts";

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

/** House rule filter params forwarded from the request body. */
export interface SoloHouseRules {
  genreId?: number;
  platformFamily?: string;
  decadeStart?: number;
}

/** All DB operation signatures for solo-start. */
export interface SoloStartDbOperations {
  fetchEligibleGames: (difficulty: string, houseRules?: SoloHouseRules) => Promise<EligibleGame[]>;
  fetchRevealedCardData: (gameId: number) => Promise<RevealedCardData>;
  fetchHiddenCardData: (gameId: number) => Promise<HiddenCardData>;
  createSession: (
    difficulty: string,
    state: InitialSessionState,
    anchorReleaseYear: number,
  ) => Promise<string>; // returns session_id
}

/**
 * Difficulty-to-rank-threshold map (mirrors the build_deck RPC logic).
 */
const DIFFICULTY_MAX_RANK: Record<string, number | null> = {
  easy: 10,
  medium: 20,
  hard: 50,
  extreme: null,
};

export function createSoloStartDbOperations(supabase: SupabaseClient): SoloStartDbOperations {
  return {
    async fetchEligibleGames(
      difficulty: string,
      houseRules?: SoloHouseRules,
    ): Promise<EligibleGame[]> {
      const maxRank = DIFFICULTY_MAX_RANK[difficulty] ?? null;

      // Call the build_deck RPC which applies all filters and the pool size guard.
      const rpcArgs: Record<string, unknown> = {};
      if (maxRank !== null) rpcArgs["p_max_rank"] = maxRank;
      if (houseRules?.genreId != null) rpcArgs["p_genre_id"] = houseRules.genreId;
      if (houseRules?.platformFamily != null)
        rpcArgs["p_platform_family"] = houseRules.platformFamily;
      if (houseRules?.decadeStart != null) rpcArgs["p_decade_start"] = houseRules.decadeStart;

      const { data: deckIds, error: deckError } = await supabase.rpc("build_deck", rpcArgs);

      if (deckError !== null) {
        throw new Error(`Failed to build deck: ${deckError.message}`);
      }

      if (!Array.isArray(deckIds) || deckIds.length === 0) {
        return [];
      }

      // Fetch release_year for the returned game IDs.
      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id, release_year")
        .in("id", deckIds as number[]);

      if (gamesError !== null) {
        throw new Error(`Failed to fetch game metadata: ${gamesError.message}`);
      }

      return (games ?? []) as EligibleGame[];
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

    async createSession(
      difficulty: string,
      state: InitialSessionState,
      anchorReleaseYear: number,
    ): Promise<string> {
      const timeline = [{ game_id: state.anchor.id, release_year: anchorReleaseYear }];

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
        throw new Error(`Failed to create solo session: ${error?.message ?? "no data"}`);
      }

      return (data as { id: string }).id;
    },
  };
}
