/**
 * TypeScript types for IGDB API responses.
 *
 * IGDB returns only the fields you request via the Apicalypse query language.
 * All non-id fields are optional since any subset may be selected.
 */

// --- Twitch OAuth ---

export interface TwitchTokenResponse {
  access_token: string;
  expires_in: number; // seconds until expiry
  token_type: string;
}

// --- Shared ---

/** Common fields for cover and screenshot image objects. */
export interface IgdbImageData {
  id: number;
  image_id?: string;
  width?: number;
  height?: number;
}

// --- Entity types ---

export interface IgdbPlatform {
  id: number;
  name?: string;
  slug?: string;
}

export interface IgdbGenre {
  id: number;
  name?: string;
  slug?: string;
}

export interface IgdbCover extends IgdbImageData {
  /** ID of the parent game (present when fetching covers directly). */
  game?: number;
}

export interface IgdbScreenshot extends IgdbImageData {
  /** ID of the parent game (present when fetching screenshots directly). */
  game?: number;
}

/**
 * A game record from IGDB.
 *
 * When fetching with expanded relations (e.g. `cover.image_id`), nested
 * objects are returned. When fetching without expansion, relation fields
 * contain numeric IDs — but we always use expanded queries in this project.
 */
export interface IgdbGame {
  id: number;
  name?: string;
  slug?: string;
  /** Unix timestamp of the first public release. */
  first_release_date?: number;
  summary?: string;
  rating?: number;
  rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  follows?: number;
  hypes?: number;
  /**
   * IGDB game category:
   * 0 = main_game, 8 = remake, 9 = remaster
   * (we filter to these three in import queries)
   */
  category?: number;
  /** Unix timestamp of last update in IGDB. */
  updated_at?: number;
  cover?: IgdbCover;
  screenshots?: IgdbScreenshot[];
  platforms?: IgdbPlatform[];
  genres?: IgdbGenre[];
}

// --- Error codes ---

export type IgdbErrorCode = "rate_limit" | "unauthorized" | "api_error" | "network_error";
