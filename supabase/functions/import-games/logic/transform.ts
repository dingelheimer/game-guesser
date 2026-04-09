/**
 * Pure transformation functions: IGDB API data → database insert payloads.
 *
 * No I/O, no runtime dependencies — safe to unit-test with Vitest.
 */

// ---------------------------------------------------------------------------
// Input types (IGDB API shapes)
// ---------------------------------------------------------------------------

export interface IgdbPlatformInput {
  id: number;
  name?: string;
}

export interface IgdbGenreInput {
  id: number;
  name?: string;
}

export interface IgdbCoverInput {
  id: number;
  image_id?: string;
  width?: number;
  height?: number;
}

export interface IgdbScreenshotInput {
  id: number;
  image_id?: string;
  width?: number;
  height?: number;
}

export interface IgdbGameInput {
  id: number;
  name?: string;
  slug?: string;
  /** Unix timestamp in seconds. */
  first_release_date?: number;
  summary?: string;
  rating?: number;
  rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  follows?: number;
  hypes?: number;
  /** Unix timestamp in seconds. */
  updated_at?: number;
  cover?: IgdbCoverInput;
  screenshots?: IgdbScreenshotInput[];
  platforms?: IgdbPlatformInput[];
  genres?: IgdbGenreInput[];
}

// ---------------------------------------------------------------------------
// Output types (database insert shapes)
// ---------------------------------------------------------------------------

export interface GameInsert {
  igdb_id: number;
  name: string;
  slug: string | null;
  first_release_date: string; // ISO date "YYYY-MM-DD"
  release_year: number;
  summary: string | null;
  rating: number | null;
  rating_count: number;
  total_rating: number | null;
  total_rating_count: number;
  follows: number;
  hypes: number;
  igdb_updated_at: string | null;
}

export interface PlatformInsert {
  igdb_id: number;
  name: string;
}

export interface GenreInsert {
  igdb_id: number;
  name: string;
}

export interface CoverInsert {
  game_id: number;
  igdb_image_id: string;
  width: number | null;
  height: number | null;
}

export interface ScreenshotInsert {
  game_id: number;
  igdb_image_id: string;
  width: number | null;
  height: number | null;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Transform functions
// ---------------------------------------------------------------------------

/**
 * Convert an IGDB game record to a database insert payload.
 * Returns null if required fields (name or first_release_date) are absent.
 */
export function transformGame(game: IgdbGameInput): GameInsert | null {
  if (game.name === undefined || game.first_release_date === undefined) {
    return null;
  }

  const releaseDate = new Date(game.first_release_date * 1000);
  const dateParts = releaseDate.toISOString().split("T");
  const dateStr = dateParts[0];
  if (dateStr === undefined) return null;

  return {
    igdb_id: game.id,
    name: game.name,
    slug: game.slug ?? null,
    first_release_date: dateStr,
    release_year: releaseDate.getUTCFullYear(),
    summary: game.summary ?? null,
    rating: game.rating ?? null,
    rating_count: game.rating_count ?? 0,
    total_rating: game.total_rating ?? null,
    total_rating_count: game.total_rating_count ?? 0,
    follows: game.follows ?? 0,
    hypes: game.hypes ?? 0,
    igdb_updated_at:
      game.updated_at !== undefined
        ? new Date(game.updated_at * 1000).toISOString()
        : null,
  };
}

/**
 * Convert an IGDB platform to a database insert payload.
 * Returns null if name is missing.
 */
export function transformPlatform(
  platform: IgdbPlatformInput,
): PlatformInsert | null {
  if (platform.name === undefined) return null;
  return { igdb_id: platform.id, name: platform.name };
}

/**
 * Convert an IGDB genre to a database insert payload.
 * Returns null if name is missing.
 */
export function transformGenre(genre: IgdbGenreInput): GenreInsert | null {
  if (genre.name === undefined) return null;
  return { igdb_id: genre.id, name: genre.name };
}

/**
 * Convert an IGDB cover to a database insert payload.
 * Returns null if image_id is missing.
 */
export function transformCover(
  cover: IgdbCoverInput,
  gameDbId: number,
): CoverInsert | null {
  if (cover.image_id === undefined) return null;
  return {
    game_id: gameDbId,
    igdb_image_id: cover.image_id,
    width: cover.width ?? null,
    height: cover.height ?? null,
  };
}

/**
 * Convert IGDB screenshots to database insert payloads.
 * Preserves original order; assigns sort_order starting at 0.
 * Filters out screenshots that lack image_id.
 */
export function transformScreenshots(
  screenshots: IgdbScreenshotInput[],
  gameDbId: number,
): ScreenshotInsert[] {
  const result: ScreenshotInsert[] = [];
  let sortOrder = 0;
  for (const s of screenshots) {
    if (s.image_id === undefined) continue;
    result.push({
      game_id: gameDbId,
      igdb_image_id: s.image_id,
      width: s.width ?? null,
      height: s.height ?? null,
      sort_order: sortOrder++,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

/** Number of results per IGDB API page (max allowed by IGDB). */
export const IGDB_PAGE_SIZE = 500;

/**
 * Build an Apicalypse query to fetch games released in a specific year.
 *
 * @param year - The release year to fetch (e.g. 2005)
 * @param offset - Pagination offset (0, 500, 1000, ...)
 * @param minRatingCount - Minimum rating_count to exclude obscure games
 */
export function buildImportQuery(
  year: number,
  offset: number,
  minRatingCount: number,
): string {
  const startUnix = Math.floor(
    new Date(`${String(year)}-01-01T00:00:00Z`).getTime() / 1000,
  );
  const endUnix = Math.floor(
    new Date(`${String(year + 1)}-01-01T00:00:00Z`).getTime() / 1000,
  );
  return [
    "fields id, name, slug, first_release_date, summary,",
    "       rating, rating_count, total_rating, total_rating_count,",
    "       follows, hypes, updated_at,",
    "       cover.id, cover.image_id, cover.width, cover.height,",
    "       screenshots.id, screenshots.image_id, screenshots.width, screenshots.height,",
    "       platforms.id, platforms.name,",
    "       genres.id, genres.name;",
    `where first_release_date >= ${String(startUnix)}`,
    `    & first_release_date < ${String(endUnix)}`,
    "    & cover != null",
    "    & screenshots != null",
    "    & (category = null | category = 0 | category = 8 | category = 9)",
    `    & rating_count >= ${String(minRatingCount)};`,
    "sort first_release_date asc;",
    `limit ${String(IGDB_PAGE_SIZE)};`,
    `offset ${String(offset)};`,
  ].join("\n");
}
