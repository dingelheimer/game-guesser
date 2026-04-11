/**
 * Orchestration layer for the IGDB game import pipeline.
 *
 * Accepts injected IGDB fetcher and database operations so that the
 * orchestration logic can be unit-tested without real network or DB calls.
 */
import {
  buildImportQuery,
  IGDB_PAGE_SIZE,
  transformCover,
  transformGame,
  transformGenre,
  transformPlatform,
  transformScreenshots,
} from "./transform.ts";
import type {
  CoverInsert,
  GameInsert,
  GenreInsert,
  IgdbGameInput,
  IgdbGenreInput,
  IgdbPlatformInput,
  PlatformInsert,
  ScreenshotInsert,
} from "./transform.ts";

// Re-export for consumers that only need to import from this module.
export type { IgdbGameInput };

// ---------------------------------------------------------------------------
// Dependency interfaces
// ---------------------------------------------------------------------------

/** Fetches a page of IGDB games using the given Apicalypse query string. */
export type IgdbFetcher = (query: string) => Promise<IgdbGameInput[]>;

export interface IdMap {
  igdb_id: number;
  id: number;
}

/** All database operations needed by the importer. */
export interface DbOperations {
  upsertGames(games: GameInsert[]): Promise<IdMap[]>;
  upsertPlatforms(platforms: PlatformInsert[]): Promise<IdMap[]>;
  upsertGenres(genres: GenreInsert[]): Promise<IdMap[]>;
  upsertCovers(covers: CoverInsert[]): Promise<void>;
  /** Delete all existing screenshots for gameDbId, then insert the new set. */
  replaceScreenshots(gameDbId: number, screenshots: ScreenshotInsert[]): Promise<void>;
  /** Delete all platform associations for gameDbId, then insert fresh ones. */
  replaceGamePlatforms(gameDbId: number, platformDbIds: number[]): Promise<void>;
  /** Delete all genre associations for gameDbId, then insert fresh ones. */
  replaceGameGenres(gameDbId: number, genreDbIds: number[]): Promise<void>;
  /** Recompute popularity_score and popularity_rank_per_year for all games. */
  refreshRankings(): Promise<void>;
  /**
   * Return the last year that was fully processed in a previous import run,
   * or null if no progress has been saved yet.
   */
  getImportProgress(): Promise<number | null>;
  /** Persist the last fully-processed year so a future run can resume. */
  saveImportProgress(year: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Parameters & results
// ---------------------------------------------------------------------------

export interface ImportParams {
  start_year: number;
  end_year: number;
  min_rating_count: number;
  /**
   * When true (the default), skip years that were already fully processed in a
   * previous run by reading progress from the database. Pass false to force a
   * full re-import from start_year.
   */
  resume?: boolean;
}

export interface YearResult {
  year: number;
  imported: number;
  skipped: number;
  pages: number;
}

export interface ImportResult {
  total_imported: number;
  total_skipped: number;
  years: YearResult[];
}

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------

interface BatchResult {
  imported: number;
  skipped: number;
}

/** Process one page of IGDB game records into the database. */
export async function processBatch(games: IgdbGameInput[], db: DbOperations): Promise<BatchResult> {
  let imported = 0;
  let skipped = 0;

  // --- Collect unique platforms and genres across the batch ---
  const platformsMap = new Map<number, IgdbPlatformInput>();
  const genresMap = new Map<number, IgdbGenreInput>();
  for (const game of games) {
    for (const p of game.platforms ?? []) platformsMap.set(p.id, p);
    for (const g of game.genres ?? []) genresMap.set(g.id, g);
  }

  // --- Upsert platforms and genres in parallel ---
  const platformInserts: PlatformInsert[] = [];
  for (const p of platformsMap.values()) {
    const ins = transformPlatform(p);
    if (ins !== null) platformInserts.push(ins);
  }

  const genreInserts: GenreInsert[] = [];
  for (const g of genresMap.values()) {
    const ins = transformGenre(g);
    if (ins !== null) genreInserts.push(ins);
  }

  const [platformIdMaps, genreIdMaps] = await Promise.all([
    platformInserts.length > 0
      ? db.upsertPlatforms(platformInserts)
      : (Promise.resolve([]) as Promise<IdMap[]>),
    genreInserts.length > 0
      ? db.upsertGenres(genreInserts)
      : (Promise.resolve([]) as Promise<IdMap[]>),
  ]);

  const platformDbIds = new Map<number, number>(
    platformIdMaps.map(({ igdb_id, id }) => [igdb_id, id] as [number, number]),
  );
  const genreDbIds = new Map<number, number>(
    genreIdMaps.map(({ igdb_id, id }) => [igdb_id, id] as [number, number]),
  );

  // --- Transform and upsert games ---
  type ValidGame = { insert: GameInsert; input: IgdbGameInput };
  const validGames: ValidGame[] = [];

  for (const game of games) {
    const insert = transformGame(game);
    if (insert === null) {
      skipped++;
      continue;
    }
    validGames.push({ insert, input: game });
  }

  if (validGames.length === 0) return { imported: 0, skipped };

  const gameIdMaps = await db.upsertGames(validGames.map((g) => g.insert));
  const gameDbIdsMap = new Map<number, number>(
    gameIdMaps.map(({ igdb_id, id }) => [igdb_id, id] as [number, number]),
  );

  // --- Batch covers + per-game relations ---
  const allCovers: CoverInsert[] = [];
  const perGameTasks: Array<() => Promise<void>> = [];

  for (const { input: game } of validGames) {
    const gameDbId = gameDbIdsMap.get(game.id);
    if (gameDbId === undefined) {
      skipped++;
      continue;
    }

    // Cover (batched across all games)
    if (game.cover !== undefined) {
      const cover = transformCover(game.cover, gameDbId);
      if (cover !== null) allCovers.push(cover);
    }

    // Per-game: screenshots, platform relations, genre relations
    const screenshots = transformScreenshots(game.screenshots ?? [], gameDbId);
    const platDbIds = (game.platforms ?? [])
      .map((p) => platformDbIds.get(p.id))
      .filter((id): id is number => id !== undefined);
    const genDbIds = (game.genres ?? [])
      .map((g) => genreDbIds.get(g.id))
      .filter((id): id is number => id !== undefined);

    const capturedId = gameDbId;
    perGameTasks.push(async () => {
      await db.replaceScreenshots(capturedId, screenshots);
      await db.replaceGamePlatforms(capturedId, platDbIds);
      await db.replaceGameGenres(capturedId, genDbIds);
    });

    imported++;
  }

  if (allCovers.length > 0) {
    await db.upsertCovers(allCovers);
  }
  await Promise.all(perGameTasks.map((t) => t()));

  return { imported, skipped };
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Import games from IGDB for the given year range.
 *
 * Iterates year-by-year, paginates through IGDB results, and upserts all
 * games with their covers, screenshots, platforms, and genres.
 *
 * @param params   - Year range and minimum rating_count filter
 * @param igdbFetch - Injected IGDB API fetcher
 * @param db       - Injected database operations
 * @param log      - Optional logger (defaults to console.log)
 */
export async function importGames(
  params: ImportParams,
  igdbFetch: IgdbFetcher,
  db: DbOperations,
  log: (msg: string) => void = console.log,
): Promise<ImportResult> {
  const years: YearResult[] = [];
  let totalImported = 0;
  let totalSkipped = 0;

  // --- Resume support ---
  const shouldResume = params.resume !== false;
  let effectiveStartYear = params.start_year;

  if (shouldResume) {
    const lastCompleted = await db.getImportProgress();
    if (lastCompleted !== null && lastCompleted >= params.start_year) {
      effectiveStartYear = lastCompleted + 1;
      if (effectiveStartYear > params.end_year) {
        log(
          `[import-games] Already completed through year ${String(lastCompleted)}, nothing to do.`,
        );
        return { total_imported: 0, total_skipped: 0, years: [] };
      }
      log(
        `[import-games] Resuming from year ${String(effectiveStartYear)} (last completed: ${String(lastCompleted)})`,
      );
    }
  }

  for (let year = effectiveStartYear; year <= params.end_year; year++) {
    let offset = 0;
    let yearImported = 0;
    let yearSkipped = 0;
    let pages = 0;

    log(`[import-games] Starting year ${String(year)}`);

    while (true) {
      const query = buildImportQuery(year, offset, params.min_rating_count);
      let games: IgdbGameInput[];

      try {
        games = await igdbFetch(query);
      } catch (err) {
        log(
          `[import-games] Error fetching year ${String(year)}, offset ${String(offset)}: ${String(err)}`,
        );
        break;
      }

      if (games.length === 0) break;

      pages++;
      log(
        `[import-games] Year ${String(year)}, page ${String(pages)}: fetched ${String(games.length)} games`,
      );

      try {
        const result = await processBatch(games, db);
        yearImported += result.imported;
        yearSkipped += result.skipped;
      } catch (err) {
        log(
          `[import-games] Error processing batch year ${String(year)}, offset ${String(offset)}: ${String(err)}`,
        );
      }

      if (games.length < IGDB_PAGE_SIZE) break;
      offset += IGDB_PAGE_SIZE;
    }

    log(
      `[import-games] Year ${String(year)} done: ${String(yearImported)} imported, ${String(yearSkipped)} skipped`,
    );

    years.push({ year, imported: yearImported, skipped: yearSkipped, pages });
    totalImported += yearImported;
    totalSkipped += yearSkipped;

    if (shouldResume) {
      await db.saveImportProgress(year);
    }
  }

  log(
    `[import-games] Complete: ${String(totalImported)} total imported, ${String(totalSkipped)} skipped`,
  );

  log("[import-games] Refreshing popularity scores and difficulty rankings...");
  await db.refreshRankings();
  log("[import-games] Rankings refreshed.");

  return {
    total_imported: totalImported,
    total_skipped: totalSkipped,
    years,
  };
}
