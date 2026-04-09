/**
 * Supabase database operations for the import-games Edge Function.
 *
 * Implements the DbOperations interface using the Supabase JS client.
 * This module is Deno-specific (uses npm: imports).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import type { DbOperations, IdMap } from "./importer.ts";
import type {
  CoverInsert,
  GameInsert,
  GenreInsert,
  PlatformInsert,
  ScreenshotInsert,
} from "./transform.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export function createDbOperations(supabase: SupabaseClient): DbOperations {
  return {
    async upsertGames(games: GameInsert[]): Promise<IdMap[]> {
      const { data, error } = await supabase
        .from("games")
        .upsert(games, { onConflict: "igdb_id" })
        .select("id, igdb_id");
      if (error) throw new Error(`upsertGames failed: ${error.message}`);
      return (data ?? []) as IdMap[];
    },

    async upsertPlatforms(platforms: PlatformInsert[]): Promise<IdMap[]> {
      const { data, error } = await supabase
        .from("platforms")
        .upsert(platforms, { onConflict: "igdb_id" })
        .select("id, igdb_id");
      if (error) throw new Error(`upsertPlatforms failed: ${error.message}`);
      return (data ?? []) as IdMap[];
    },

    async upsertGenres(genres: GenreInsert[]): Promise<IdMap[]> {
      const { data, error } = await supabase
        .from("genres")
        .upsert(genres, { onConflict: "igdb_id" })
        .select("id, igdb_id");
      if (error) throw new Error(`upsertGenres failed: ${error.message}`);
      return (data ?? []) as IdMap[];
    },

    async upsertCovers(covers: CoverInsert[]): Promise<void> {
      const { error } = await supabase
        .from("covers")
        .upsert(covers, { onConflict: "game_id" });
      if (error) throw new Error(`upsertCovers failed: ${error.message}`);
    },

    async replaceScreenshots(
      gameDbId: number,
      screenshots: ScreenshotInsert[],
    ): Promise<void> {
      const { error: deleteError } = await supabase
        .from("screenshots")
        .delete()
        .eq("game_id", gameDbId);
      if (deleteError) {
        throw new Error(
          `replaceScreenshots delete failed: ${deleteError.message}`,
        );
      }
      if (screenshots.length === 0) return;
      const { error: insertError } = await supabase
        .from("screenshots")
        .insert(screenshots);
      if (insertError) {
        throw new Error(
          `replaceScreenshots insert failed: ${insertError.message}`,
        );
      }
    },

    async replaceGamePlatforms(
      gameDbId: number,
      platformDbIds: number[],
    ): Promise<void> {
      const { error: deleteError } = await supabase
        .from("game_platforms")
        .delete()
        .eq("game_id", gameDbId);
      if (deleteError) {
        throw new Error(
          `replaceGamePlatforms delete failed: ${deleteError.message}`,
        );
      }
      if (platformDbIds.length === 0) return;
      const rows = platformDbIds.map((platform_id) => ({
        game_id: gameDbId,
        platform_id,
      }));
      const { error: insertError } = await supabase
        .from("game_platforms")
        .insert(rows);
      if (insertError) {
        throw new Error(
          `replaceGamePlatforms insert failed: ${insertError.message}`,
        );
      }
    },

    async replaceGameGenres(
      gameDbId: number,
      genreDbIds: number[],
    ): Promise<void> {
      const { error: deleteError } = await supabase
        .from("game_genres")
        .delete()
        .eq("game_id", gameDbId);
      if (deleteError) {
        throw new Error(
          `replaceGameGenres delete failed: ${deleteError.message}`,
        );
      }
      if (genreDbIds.length === 0) return;
      const rows = genreDbIds.map((genre_id) => ({
        game_id: gameDbId,
        genre_id,
      }));
      const { error: insertError } = await supabase
        .from("game_genres")
        .insert(rows);
      if (insertError) {
        throw new Error(
          `replaceGameGenres insert failed: ${insertError.message}`,
        );
      }
    },

    async refreshRankings(): Promise<void> {
      const { error } = await supabase.rpc("compute_popularity_scores");
      if (error) throw new Error(`refreshRankings failed: ${error.message}`);
    },
  };
}
