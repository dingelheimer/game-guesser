/**
 * Database operations for the solo-turn Edge Function.
 * Wraps Supabase client calls; injected into the handler for testability.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { TimelineEntry } from "./validate.ts";

/** Session fields loaded from the database. */
export interface LoadedSession {
  id: string;
  difficulty: string;
  status: string;
  score: number;
  turns_played: number;
  best_streak: number;
  current_streak: number;
  deck: number[];
  timeline: TimelineEntry[];
  failed_game_id: number | null;
  failed_position: number | null;
}

/** Full game data returned to the client after reveal. */
export interface RevealedCardData {
  game_id: number;
  name: string;
  release_year: number;
  cover_image_id: string;
  screenshot_image_ids: string[];
  platform_names: string[];
}

/** Minimal game data used to draw the next hidden card. */
export interface HiddenCardData {
  game_id: number;
  screenshot_image_ids: string[];
}

/** Fields to persist after a turn. */
export interface SessionUpdate {
  status: string;
  score: number;
  turns_played: number;
  best_streak: number;
  current_streak: number;
  deck: number[];
  timeline: TimelineEntry[];
  failed_game_id?: number | null;
  failed_position?: number | null;
}

export interface SoloTurnDbOperations {
  loadSession: (sessionId: string) => Promise<LoadedSession>;
  saveSession: (sessionId: string, update: SessionUpdate) => Promise<void>;
  fetchRevealedCardData: (gameId: number) => Promise<RevealedCardData>;
  fetchHiddenCardData: (gameId: number) => Promise<HiddenCardData>;
  /** Fetch only the release year for the current card (used for validation). */
  fetchReleaseYear: (gameId: number) => Promise<number>;
}

export function createSoloTurnDbOperations(
  supabase: SupabaseClient,
): SoloTurnDbOperations {
  return {
    async loadSession(sessionId: string): Promise<LoadedSession> {
      const { data, error } = await supabase
        .from("solo_sessions")
        .select(
          "id, difficulty, status, score, turns_played, best_streak, current_streak, deck, timeline, failed_game_id, failed_position",
        )
        .eq("id", sessionId)
        .single();

      if (error !== null || data === null) {
        throw new Error(
          `Session not found: ${error?.message ?? "no data"}`,
        );
      }

      return data as LoadedSession;
    },

    async saveSession(sessionId: string, update: SessionUpdate): Promise<void> {
      const { error } = await supabase
        .from("solo_sessions")
        .update(update)
        .eq("id", sessionId);

      if (error !== null) {
        throw new Error(`Failed to save session: ${error.message}`);
      }
    },

    async fetchReleaseYear(gameId: number): Promise<number> {
      const { data, error } = await supabase
        .from("games")
        .select("release_year")
        .eq("id", gameId)
        .single();

      if (error !== null || data === null) {
        throw new Error(
          `Failed to fetch game ${gameId.toString()}: ${error?.message ?? "not found"}`,
        );
      }

      return (data as { release_year: number }).release_year;
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
  };
}
