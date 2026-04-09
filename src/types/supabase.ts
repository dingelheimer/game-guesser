// Manually maintained until `supabase start` (requires Docker) is available.
// Regenerate after migrations with: pnpm db:types:local  (requires Docker)
// Schema source: supabase/migrations/20260409000000_create_game_schema.sql

import type { DifficultyTier } from "@/lib/difficulty";
export type { DifficultyTier };

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CurationStatus = "curated" | "uncurated" | "rejected";

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: number;
          igdb_id: number;
          name: string;
          slug: string | null;
          first_release_date: string; // ISO date string
          release_year: number;
          summary: string | null;
          rating: number | null;
          rating_count: number;
          total_rating: number | null;
          total_rating_count: number;
          follows: number;
          hypes: number;
          popularity_score: number | null;
          popularity_rank_per_year: number | null;
          igdb_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: never; // generated always
          igdb_id: number;
          name: string;
          slug?: string | null;
          first_release_date: string;
          release_year: number;
          summary?: string | null;
          rating?: number | null;
          rating_count?: number;
          total_rating?: number | null;
          total_rating_count?: number;
          follows?: number;
          hypes?: number;
          popularity_score?: number | null;
          popularity_rank_per_year?: number | null;
          igdb_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: never;
          igdb_id?: number;
          name?: string;
          slug?: string | null;
          first_release_date?: string;
          release_year?: number;
          summary?: string | null;
          rating?: number | null;
          rating_count?: number;
          total_rating?: number | null;
          total_rating_count?: number;
          follows?: number;
          hypes?: number;
          popularity_score?: number | null;
          popularity_rank_per_year?: number | null;
          igdb_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      platforms: {
        Row: {
          id: number;
          igdb_id: number;
          name: string;
        };
        Insert: {
          id?: never;
          igdb_id: number;
          name: string;
        };
        Update: {
          id?: never;
          igdb_id?: number;
          name?: string;
        };
      };
      genres: {
        Row: {
          id: number;
          igdb_id: number;
          name: string;
        };
        Insert: {
          id?: never;
          igdb_id: number;
          name: string;
        };
        Update: {
          id?: never;
          igdb_id?: number;
          name?: string;
        };
      };
      game_platforms: {
        Row: {
          game_id: number;
          platform_id: number;
        };
        Insert: {
          game_id: number;
          platform_id: number;
        };
        Update: {
          game_id?: number;
          platform_id?: number;
        };
      };
      game_genres: {
        Row: {
          game_id: number;
          genre_id: number;
        };
        Insert: {
          game_id: number;
          genre_id: number;
        };
        Update: {
          game_id?: number;
          genre_id?: number;
        };
      };
      covers: {
        Row: {
          id: number;
          game_id: number;
          igdb_image_id: string;
          width: number | null;
          height: number | null;
        };
        Insert: {
          id?: never;
          game_id: number;
          igdb_image_id: string;
          width?: number | null;
          height?: number | null;
        };
        Update: {
          id?: never;
          game_id?: number;
          igdb_image_id?: string;
          width?: number | null;
          height?: number | null;
        };
      };
      screenshots: {
        Row: {
          id: number;
          game_id: number;
          igdb_image_id: string;
          width: number | null;
          height: number | null;
          sort_order: number;
          curation: CurationStatus;
        };
        Insert: {
          id?: never;
          game_id: number;
          igdb_image_id: string;
          width?: number | null;
          height?: number | null;
          sort_order?: number;
          curation?: CurationStatus;
        };
        Update: {
          id?: never;
          game_id?: number;
          igdb_image_id?: string;
          width?: number | null;
          height?: number | null;
          sort_order?: number;
          curation?: CurationStatus;
        };
      };
      sync_state: {
        Row: {
          key: string;
          value: string;
        };
        Insert: {
          key: string;
          value: string;
        };
        Update: {
          key?: string;
          value?: string;
        };
      };
    };
    Views: {
      games_by_difficulty: {
        Row: {
          id: number;
          igdb_id: number;
          name: string;
          slug: string | null;
          first_release_date: string;
          release_year: number;
          summary: string | null;
          rating: number | null;
          rating_count: number;
          total_rating: number | null;
          total_rating_count: number;
          follows: number;
          hypes: number;
          popularity_score: number | null;
          popularity_rank_per_year: number | null;
          igdb_updated_at: string | null;
          created_at: string;
          updated_at: string;
          difficulty_tier: DifficultyTier;
        };
      };
    };
    Functions: {
      compute_popularity_scores: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      curation_status: CurationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row types
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Platform = Database["public"]["Tables"]["platforms"]["Row"];
export type Genre = Database["public"]["Tables"]["genres"]["Row"];
export type Cover = Database["public"]["Tables"]["covers"]["Row"];
export type Screenshot = Database["public"]["Tables"]["screenshots"]["Row"];
export type SyncState = Database["public"]["Tables"]["sync_state"]["Row"];
export type GameByDifficulty =
  Database["public"]["Views"]["games_by_difficulty"]["Row"];
