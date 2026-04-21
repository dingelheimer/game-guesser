export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      covers: {
        Row: {
          game_id: number;
          height: number | null;
          id: number;
          igdb_image_id: string;
          width: number | null;
        };
        Insert: {
          game_id: number;
          height?: number | null;
          id?: never;
          igdb_image_id: string;
          width?: number | null;
        };
        Update: {
          game_id?: number;
          height?: number | null;
          id?: never;
          igdb_image_id?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "covers_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "covers_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "games_by_difficulty";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_challenge_results: {
        Row: {
          anonymous_id: string | null;
          challenge_id: number;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          extra_try_used: boolean;
          id: number;
          placements: Json;
          score: number;
          turns_played: number;
          user_id: string | null;
        };
        Insert: {
          anonymous_id?: string | null;
          challenge_id: number;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          extra_try_used?: boolean;
          id?: number;
          placements?: Json;
          score?: number;
          turns_played?: number;
          user_id?: string | null;
        };
        Update: {
          anonymous_id?: string | null;
          challenge_id?: number;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          extra_try_used?: boolean;
          id?: number;
          placements?: Json;
          score?: number;
          turns_played?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "daily_challenge_results_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "daily_challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_challenge_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_challenges: {
        Row: {
          challenge_date: string;
          challenge_number: number;
          created_at: string;
          deck: number[];
          difficulty: string;
          id: number;
          variant: string;
        };
        Insert: {
          challenge_date: string;
          challenge_number: number;
          created_at?: string;
          deck: number[];
          difficulty?: string;
          id?: number;
          variant?: string;
        };
        Update: {
          challenge_date?: string;
          challenge_number?: number;
          created_at?: string;
          deck?: number[];
          difficulty?: string;
          id?: number;
          variant?: string;
        };
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "game_genres_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_genres_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games_by_difficulty";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_genres_genre_id_fkey";
            columns: ["genre_id"];
            isOneToOne: false;
            referencedRelation: "genres";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "game_platforms_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_platforms_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games_by_difficulty";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_platforms_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      game_players: {
        Row: {
          display_name: string;
          game_session_id: string;
          score: number;
          timeline: Json;
          tokens: number;
          turn_position: number;
          user_id: string;
        };
        Insert: {
          display_name: string;
          game_session_id: string;
          score?: number;
          timeline?: Json;
          tokens?: number;
          turn_position: number;
          user_id: string;
        };
        Update: {
          display_name?: string;
          game_session_id?: string;
          score?: number;
          timeline?: Json;
          tokens?: number;
          turn_position?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_players_game_session_id_fkey";
            columns: ["game_session_id"];
            isOneToOne: false;
            referencedRelation: "game_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_players_game_session_id_fkey";
            columns: ["game_session_id"];
            isOneToOne: false;
            referencedRelation: "game_sessions_safe";
            referencedColumns: ["id"];
          },
        ];
      };
      game_sessions: {
        Row: {
          active_player_id: string | null;
          created_at: string;
          current_turn: Json | null;
          deck: number[];
          deck_cursor: number;
          id: string;
          room_id: string;
          settings: Json;
          status: string;
          team_score: number | null;
          team_timeline: Json | null;
          team_tokens: number | null;
          turn_number: number;
          turn_order: string[];
          updated_at: string;
          winner_id: string | null;
        };
        Insert: {
          active_player_id?: string | null;
          created_at?: string;
          current_turn?: Json | null;
          deck: number[];
          deck_cursor?: number;
          id?: string;
          room_id: string;
          settings?: Json;
          status?: string;
          team_score?: number | null;
          team_timeline?: Json | null;
          team_tokens?: number | null;
          turn_number?: number;
          turn_order: string[];
          updated_at?: string;
          winner_id?: string | null;
        };
        Update: {
          active_player_id?: string | null;
          created_at?: string;
          current_turn?: Json | null;
          deck?: number[];
          deck_cursor?: number;
          id?: string;
          room_id?: string;
          settings?: Json;
          status?: string;
          team_score?: number | null;
          team_timeline?: Json | null;
          team_tokens?: number | null;
          turn_number?: number;
          turn_order?: string[];
          updated_at?: string;
          winner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_sessions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          created_at: string;
          first_release_date: string;
          follows: number | null;
          hypes: number | null;
          id: number;
          igdb_id: number;
          igdb_updated_at: string | null;
          name: string;
          popularity_rank_per_year: number | null;
          popularity_score: number | null;
          rating: number | null;
          rating_count: number | null;
          release_year: number;
          slug: string | null;
          summary: string | null;
          total_rating: number | null;
          total_rating_count: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_release_date: string;
          follows?: number | null;
          hypes?: number | null;
          id?: never;
          igdb_id: number;
          igdb_updated_at?: string | null;
          name: string;
          popularity_rank_per_year?: number | null;
          popularity_score?: number | null;
          rating?: number | null;
          rating_count?: number | null;
          release_year: number;
          slug?: string | null;
          summary?: string | null;
          total_rating?: number | null;
          total_rating_count?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_release_date?: string;
          follows?: number | null;
          hypes?: number | null;
          id?: never;
          igdb_id?: number;
          igdb_updated_at?: string | null;
          name?: string;
          popularity_rank_per_year?: number | null;
          popularity_score?: number | null;
          rating?: number | null;
          rating_count?: number | null;
          release_year?: number;
          slug?: string | null;
          summary?: string | null;
          total_rating?: number | null;
          total_rating_count?: number | null;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      leaderboard_entries: {
        Row: {
          created_at: string;
          difficulty: string | null;
          id: number;
          score: number;
          streak: number;
          user_id: string;
          variant: string | null;
        };
        Insert: {
          created_at?: string;
          difficulty?: string | null;
          id?: number;
          score: number;
          streak?: number;
          user_id: string;
          variant?: string | null;
        };
        Update: {
          created_at?: string;
          difficulty?: string | null;
          id?: number;
          score?: number;
          streak?: number;
          user_id?: string;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platforms: {
        Row: {
          family: string;
          id: number;
          igdb_id: number;
          name: string;
        };
        Insert: {
          family?: string;
          id?: never;
          igdb_id: number;
          name: string;
        };
        Update: {
          family?: string;
          id?: never;
          igdb_id?: number;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      room_players: {
        Row: {
          display_name: string;
          joined_at: string;
          role: string;
          room_id: string;
          user_id: string;
        };
        Insert: {
          display_name: string;
          joined_at?: string;
          role?: string;
          room_id: string;
          user_id: string;
        };
        Update: {
          display_name?: string;
          joined_at?: string;
          role?: string;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          code: string;
          created_at: string;
          host_id: string;
          id: string;
          max_players: number;
          settings: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          host_id: string;
          id?: string;
          max_players?: number;
          settings?: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          host_id?: string;
          id?: string;
          max_players?: number;
          settings?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      screenshots: {
        Row: {
          curation: string | null;
          game_id: number;
          height: number | null;
          id: number;
          igdb_image_id: string;
          sort_order: number | null;
          width: number | null;
        };
        Insert: {
          curation?: string | null;
          game_id: number;
          height?: number | null;
          id?: never;
          igdb_image_id: string;
          sort_order?: number | null;
          width?: number | null;
        };
        Update: {
          curation?: string | null;
          game_id?: number;
          height?: number | null;
          id?: never;
          igdb_image_id?: string;
          sort_order?: number | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "screenshots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "screenshots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games_by_difficulty";
            referencedColumns: ["id"];
          },
        ];
      };
      solo_sessions: {
        Row: {
          best_streak: number;
          created_at: string;
          current_streak: number;
          deck: number[];
          difficulty: string;
          failed_game_id: number | null;
          failed_position: number | null;
          id: string;
          score: number;
          status: string;
          timeline: Json;
          turns_played: number;
          updated_at: string;
        };
        Insert: {
          best_streak?: number;
          created_at?: string;
          current_streak?: number;
          deck: number[];
          difficulty: string;
          failed_game_id?: number | null;
          failed_position?: number | null;
          id?: string;
          score?: number;
          status?: string;
          timeline?: Json;
          turns_played?: number;
          updated_at?: string;
        };
        Update: {
          best_streak?: number;
          created_at?: string;
          current_streak?: number;
          deck?: number[];
          difficulty?: string;
          failed_game_id?: number | null;
          failed_position?: number | null;
          id?: string;
          score?: number;
          status?: string;
          timeline?: Json;
          turns_played?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "solo_sessions_failed_game_id_fkey";
            columns: ["failed_game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solo_sessions_failed_game_id_fkey";
            columns: ["failed_game_id"];
            isOneToOne: false;
            referencedRelation: "games_by_difficulty";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [];
      };
    };
    Views: {
      game_sessions_safe: {
        Row: {
          active_player_id: string | null;
          created_at: string | null;
          current_turn: Json | null;
          id: string | null;
          room_id: string | null;
          settings: Json | null;
          status: string | null;
          team_score: number | null;
          team_timeline: Json | null;
          team_tokens: number | null;
          turn_number: number | null;
          turn_order: string[] | null;
          updated_at: string | null;
          winner_id: string | null;
        };
        Insert: {
          active_player_id?: string | null;
          created_at?: string | null;
          current_turn?: Json | null;
          id?: string | null;
          room_id?: string | null;
          settings?: Json | null;
          status?: string | null;
          team_score?: number | null;
          team_timeline?: Json | null;
          team_tokens?: number | null;
          turn_number?: number | null;
          turn_order?: string[] | null;
          updated_at?: string | null;
          winner_id?: string | null;
        };
        Update: {
          active_player_id?: string | null;
          created_at?: string | null;
          current_turn?: Json | null;
          id?: string | null;
          room_id?: string | null;
          settings?: Json | null;
          status?: string | null;
          team_score?: number | null;
          team_timeline?: Json | null;
          team_tokens?: number | null;
          turn_number?: number | null;
          turn_order?: string[] | null;
          updated_at?: string | null;
          winner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_sessions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      games_by_difficulty: {
        Row: {
          created_at: string | null;
          difficulty_tier: string | null;
          first_release_date: string | null;
          follows: number | null;
          hypes: number | null;
          id: number | null;
          igdb_id: number | null;
          igdb_updated_at: string | null;
          name: string | null;
          popularity_rank_per_year: number | null;
          popularity_score: number | null;
          rating: number | null;
          rating_count: number | null;
          release_year: number | null;
          slug: string | null;
          summary: string | null;
          total_rating: number | null;
          total_rating_count: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          difficulty_tier?: never;
          first_release_date?: string | null;
          follows?: number | null;
          hypes?: number | null;
          id?: number | null;
          igdb_id?: number | null;
          igdb_updated_at?: string | null;
          name?: string | null;
          popularity_rank_per_year?: number | null;
          popularity_score?: number | null;
          rating?: number | null;
          rating_count?: number | null;
          release_year?: number | null;
          slug?: string | null;
          summary?: string | null;
          total_rating?: number | null;
          total_rating_count?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          difficulty_tier?: never;
          first_release_date?: string | null;
          follows?: number | null;
          hypes?: number | null;
          id?: number | null;
          igdb_id?: number | null;
          igdb_updated_at?: string | null;
          name?: string | null;
          popularity_rank_per_year?: number | null;
          popularity_score?: number | null;
          rating?: number | null;
          rating_count?: number | null;
          release_year?: number | null;
          slug?: string | null;
          summary?: string | null;
          total_rating?: number | null;
          total_rating_count?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      abandon_stale_rooms: {
        Args: { stale_threshold_hours?: number };
        Returns: number;
      };
      append_accepted_player_id: {
        Args: { p_session_id: string; p_turn_number: number; p_user_id: string };
        Returns: Json;
      };
      build_deck: {
        Args: {
          p_decade_start?: number;
          p_genre_id?: number;
          p_max_rank?: number;
          p_platform_family?: string;
        };
        Returns: number[];
      };
      claim_host: {
        Args: { expected_host_id: string; target_room_id: string };
        Returns: Json;
      };
      compute_popularity_scores: { Args: never; Returns: undefined };
      estimate_deck_size: {
        Args: {
          p_decade_start?: number;
          p_genre_id?: number;
          p_max_rank?: number;
          p_platform_family?: string;
        };
        Returns: number;
      };
      get_daily_eligible_game_ids: {
        Args: { p_max_rank: number };
        Returns: {
          id: number;
        }[];
      };
      is_game_session_member: {
        Args: { check_session_id: string };
        Returns: boolean;
      };
      is_room_member: { Args: { check_room_id: string }; Returns: boolean };
      leave_room: { Args: { target_room_id: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
