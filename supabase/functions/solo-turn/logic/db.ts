/**
 * Database operations for the solo-turn Edge Function.
 * Wraps Supabase client calls; injected into the handler for testability.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { TimelineEntry } from "./validate.ts";
import { getDisplayName } from "./platform-names.ts";
import { buildPlatformOptions, maxDistractorsNeeded } from "./platforms.ts";
import type { PlatformOption } from "./platforms.ts";

export { PlatformOption };

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
  /** Fetch release years for multiple game IDs in a single query. */
  fetchReleaseYears: (gameIds: number[]) => Promise<Map<number, number>>;
  /** Build platform bonus options (correct platforms + era-based distractors). */
  fetchPlatformOptions: (
    gameId: number,
    releaseYear: number,
  ) => Promise<{ options: PlatformOption[]; correctIds: number[] }>;
}

export function createSoloTurnDbOperations(supabase: SupabaseClient): SoloTurnDbOperations {
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
        throw new Error(`Session not found: ${error?.message ?? "no data"}`);
      }

      return data as LoadedSession;
    },

    async saveSession(sessionId: string, update: SessionUpdate): Promise<void> {
      const { error } = await supabase.from("solo_sessions").update(update).eq("id", sessionId);

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

    async fetchReleaseYears(gameIds: number[]): Promise<Map<number, number>> {
      if (gameIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from("games")
        .select("id, release_year")
        .in("id", gameIds);

      if (error !== null) {
        throw new Error(`Failed to fetch release years: ${error.message}`);
      }

      const result = new Map<number, number>();
      for (const game of data ?? []) {
        result.set((game as { id: number }).id, (game as { release_year: number }).release_year);
      }
      return result;
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

    async fetchPlatformOptions(
      gameId: number,
      releaseYear: number,
    ): Promise<{ options: PlatformOption[]; correctIds: number[] }> {
      // 1. Fetch all correct platforms for this game.
      const { data: correctData, error: correctErr } = await supabase
        .from("game_platforms")
        .select("platforms(id, name)")
        .eq("game_id", gameId);

      if (correctErr !== null) {
        throw new Error(
          `Failed to fetch platforms for game ${gameId.toString()}: ${correctErr.message}`,
        );
      }

      const correct: PlatformOption[] = (correctData ?? []).flatMap((row) => {
        const p = row.platforms as { id: number; name: string } | null;
        return p !== null ? [{ id: p.id, name: getDisplayName(p.name) }] : [];
      });

      const correctPlatformIds = correct.map((p) => p.id);
      const distCount = maxDistractorsNeeded(correct.length);

      // 2. Helper: fetch distractor platforms within a ±halfRange year window.
      const fetchDistractors = async (halfRange: number): Promise<PlatformOption[]> => {
        if (distCount === 0) return [];

        const minYear = releaseYear - halfRange;
        const maxYear = releaseYear + halfRange;

        // 2a. Get game IDs in the era (excluding the current game).
        const { data: eraGames, error: eraErr } = await supabase
          .from("games")
          .select("id")
          .gte("release_year", minYear)
          .lte("release_year", maxYear)
          .neq("id", gameId);

        if (eraErr !== null || !eraGames?.length) return [];

        const eraGameIds = eraGames.map((g) => (g as { id: number }).id);

        // 2b. Get distinct platform IDs used by era games, excluding correct ones.
        const { data: gpRows, error: gpErr } = await supabase
          .from("game_platforms")
          .select("platform_id")
          .in("game_id", eraGameIds);

        if (gpErr !== null || !gpRows?.length) return [];

        const candidateIds = [
          ...new Set(gpRows.map((r) => (r as { platform_id: number }).platform_id)),
        ].filter((id) => !correctPlatformIds.includes(id));

        if (candidateIds.length === 0) return [];

        // 2c. Shuffle client-side and take distCount IDs, then fetch their names.
        const shuffled = clientShuffle(candidateIds).slice(0, distCount);

        const { data: platforms, error: pErr } = await supabase
          .from("platforms")
          .select("id, name")
          .in("id", shuffled);

        if (pErr !== null) return [];

        return (platforms ?? []).map((p) => ({
          id: (p as { id: number }).id,
          name: getDisplayName((p as { name: string }).name),
        }));
      };

      let distractors = await fetchDistractors(5);

      // 3. Fall back to ±15 years if the narrow era returned too few distractors.
      const minNeeded = Math.max(0, 8 - correct.length);
      if (distractors.length < minNeeded) {
        distractors = await fetchDistractors(15);
      }

      return buildPlatformOptions(correct, distractors);
    },
  };
}

/** Fisher-Yates shuffle using Math.random (used for distractor candidate selection). */
function clientShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}
