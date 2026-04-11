import { beforeEach, describe, expect, it, vi } from "vitest";
import { importGames, processBatch } from "../../../supabase/functions/import-games/logic/importer";
import type {
  DbOperations,
  IgdbFetcher,
  IdMap,
} from "../../../supabase/functions/import-games/logic/importer";
import type {
  GameInsert,
  GenreInsert,
  IgdbGameInput,
  PlatformInsert,
  ScreenshotInsert,
} from "../../../supabase/functions/import-games/logic/transform";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGame(overrides: Partial<IgdbGameInput> = {}): IgdbGameInput {
  return {
    id: 100,
    name: "Test Game",
    slug: "test-game",
    first_release_date: 946684800, // 2000-01-01
    rating: 80,
    rating_count: 100,
    total_rating: 82,
    total_rating_count: 150,
    follows: 500,
    hypes: 20,
    cover: { id: 1, image_id: "co1test", width: 264, height: 374 },
    screenshots: [
      { id: 10, image_id: "sc1test", width: 889, height: 500 },
      { id: 11, image_id: "sc2test", width: 889, height: 500 },
    ],
    platforms: [{ id: 48, name: "PlayStation 4" }],
    genres: [{ id: 12, name: "Role-playing (RPG)" }],
    ...overrides,
  };
}

function makeMockDb(overrides: Partial<DbOperations> = {}): DbOperations {
  return {
    upsertGames: vi.fn(
      (games: GameInsert[]): Promise<IdMap[]> =>
        Promise.resolve(games.map((g, i) => ({ igdb_id: g.igdb_id, id: 1000 + i }))),
    ),
    upsertPlatforms: vi.fn(
      (platforms: PlatformInsert[]): Promise<IdMap[]> =>
        Promise.resolve(platforms.map((p, i) => ({ igdb_id: p.igdb_id, id: 200 + i }))),
    ),
    upsertGenres: vi.fn(
      (genres: GenreInsert[]): Promise<IdMap[]> =>
        Promise.resolve(genres.map((g, i) => ({ igdb_id: g.igdb_id, id: 300 + i }))),
    ),
    upsertCovers: vi.fn((): Promise<void> => Promise.resolve()),
    replaceScreenshots: vi.fn((): Promise<void> => Promise.resolve()),
    replaceGamePlatforms: vi.fn((): Promise<void> => Promise.resolve()),
    replaceGameGenres: vi.fn((): Promise<void> => Promise.resolve()),
    refreshRankings: vi.fn((): Promise<void> => Promise.resolve()),
    getImportProgress: vi.fn((): Promise<number | null> => Promise.resolve(null)),
    saveImportProgress: vi.fn((): Promise<void> => Promise.resolve()),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// processBatch
// ---------------------------------------------------------------------------

describe("processBatch", () => {
  let db: DbOperations;

  beforeEach(() => {
    db = makeMockDb();
  });

  it("upserts games, platforms, genres, covers, and screenshots", async () => {
    const games = [makeGame()];
    const result = await processBatch(games, db);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(db.upsertGames).toHaveBeenCalledOnce();
    expect(db.upsertPlatforms).toHaveBeenCalledOnce();
    expect(db.upsertGenres).toHaveBeenCalledOnce();
    expect(db.upsertCovers).toHaveBeenCalledOnce();
    expect(db.replaceScreenshots).toHaveBeenCalledOnce();
    expect(db.replaceGamePlatforms).toHaveBeenCalledOnce();
    expect(db.replaceGameGenres).toHaveBeenCalledOnce();
  });

  it("deduplicates platforms across multiple games", async () => {
    const games = [
      makeGame({ id: 1, platforms: [{ id: 48, name: "PS4" }] }),
      makeGame({ id: 2, platforms: [{ id: 48, name: "PS4" }] }),
    ];
    await processBatch(games, db);

    const platformArgs = (db.upsertPlatforms as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | PlatformInsert[]
      | undefined;
    expect(platformArgs).toHaveLength(1);
  });

  it("skips games with missing required fields", async () => {
    const games = [
      { id: 1 }, // no name or date
      makeGame({ id: 2 }),
    ];
    const result = await processBatch(games, db);
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(1);
  });

  it("returns zero imported for an empty batch", async () => {
    const result = await processBatch([], db);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(db.upsertGames).not.toHaveBeenCalled();
  });

  it("skips cover upsert when cover has no image_id", async () => {
    const games = [makeGame({ cover: { id: 1 } })]; // no image_id
    await processBatch(games, db);
    expect(db.upsertCovers).not.toHaveBeenCalled();
  });

  it("calls replaceScreenshots with empty array when game has no screenshots", async () => {
    const games = [makeGame({ screenshots: [] })];
    await processBatch(games, db);
    const args = (db.replaceScreenshots as ReturnType<typeof vi.fn>).mock.calls[0] as
      | [number, ScreenshotInsert[]]
      | undefined;
    expect(args?.[1]).toHaveLength(0);
  });

  it("does not call upsertPlatforms or upsertGenres for empty lookups", async () => {
    const games = [makeGame({ platforms: [], genres: [] })];
    await processBatch(games, db);
    expect(db.upsertPlatforms).not.toHaveBeenCalled();
    expect(db.upsertGenres).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// importGames
// ---------------------------------------------------------------------------

describe("importGames", () => {
  let db: DbOperations;
  const logs: string[] = [];

  beforeEach(() => {
    db = makeMockDb();
    logs.length = 0;
  });

  it("imports games for a single year with one page", async () => {
    const games = [makeGame()];
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce(games);

    const result = await importGames(
      { start_year: 2000, end_year: 2000, min_rating_count: 5 },
      fetcher,
      db,
      (msg) => logs.push(msg),
    );

    expect(result.total_imported).toBe(1);
    expect(result.years).toHaveLength(1);
    expect(result.years[0]?.year).toBe(2000);
    expect(result.years[0]?.imported).toBe(1);
    expect(result.years[0]?.pages).toBe(1);
  });

  it("iterates over multiple years", async () => {
    const fetcher: IgdbFetcher = vi
      .fn()
      .mockResolvedValueOnce([makeGame({ id: 1 })])
      .mockResolvedValueOnce([makeGame({ id: 2 })])
      .mockResolvedValueOnce([]);

    const result = await importGames(
      { start_year: 2000, end_year: 2001, min_rating_count: 5 },
      fetcher,
      db,
      () => {},
    );

    expect(result.years).toHaveLength(2);
    expect(result.total_imported).toBe(2);
  });

  it("paginates when a page returns IGDB_PAGE_SIZE (500) results", async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => makeGame({ id: i + 1 }));
    const lastPage = [makeGame({ id: 501 })];
    const fetcher: IgdbFetcher = vi
      .fn()
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce(lastPage);

    const result = await importGames(
      { start_year: 2000, end_year: 2000, min_rating_count: 5 },
      fetcher,
      db,
      () => {},
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.years[0]?.pages).toBe(2);
  });

  it("stops pagination when a page returns fewer than 500 results", async () => {
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce([makeGame()]);

    await importGames(
      { start_year: 2000, end_year: 2000, min_rating_count: 5 },
      fetcher,
      db,
      () => {},
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("stops pagination when a page returns zero results", async () => {
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce([]);

    const result = await importGames(
      { start_year: 2000, end_year: 2000, min_rating_count: 5 },
      fetcher,
      db,
      () => {},
    );

    expect(result.total_imported).toBe(0);
    expect(result.years[0]?.pages).toBe(0);
  });

  it("continues to next year if IGDB fetch throws", async () => {
    const fetcher: IgdbFetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce([makeGame({ id: 2 })]);

    const result = await importGames(
      { start_year: 2000, end_year: 2001, min_rating_count: 5 },
      fetcher,
      db,
      (msg) => logs.push(msg),
    );

    expect(result.years[0]?.imported).toBe(0);
    expect(result.years[1]?.imported).toBe(1);
    expect(logs.some((l) => l.includes("Network error"))).toBe(true);
  });

  it("continues processing if processBatch throws", async () => {
    const games = [makeGame()];
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce(games);
    const brokenDb = makeMockDb({
      upsertGames: vi.fn().mockRejectedValue(new Error("DB error")),
    });

    const result = await importGames(
      { start_year: 2000, end_year: 2000, min_rating_count: 5 },
      fetcher,
      brokenDb,
      (msg) => logs.push(msg),
    );

    expect(result.total_imported).toBe(0);
    expect(logs.some((l) => l.includes("DB error"))).toBe(true);
  });

  it("logs progress messages", async () => {
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce([makeGame()]);

    await importGames(
      { start_year: 2000, end_year: 2000, min_rating_count: 5 },
      fetcher,
      db,
      (msg) => logs.push(msg),
    );

    expect(logs.some((l) => l.includes("Starting year 2000"))).toBe(true);
    expect(logs.some((l) => l.includes("imported"))).toBe(true);
  });

  it("returns correct ImportResult structure", async () => {
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce([]);

    const result = await importGames(
      { start_year: 2020, end_year: 2020, min_rating_count: 5 },
      fetcher,
      db,
      () => {},
    );

    expect(result).toHaveProperty("total_imported");
    expect(result).toHaveProperty("total_skipped");
    expect(result).toHaveProperty("years");
    expect(Array.isArray(result.years)).toBe(true);
  });

  it("calls refreshRankings once after all years are imported", async () => {
    const fetcher: IgdbFetcher = vi
      .fn()
      .mockResolvedValueOnce([makeGame({ id: 1 })])
      .mockResolvedValueOnce([makeGame({ id: 2 })]);

    await importGames(
      { start_year: 2000, end_year: 2001, min_rating_count: 5 },
      fetcher,
      db,
      () => {},
    );

    expect(db.refreshRankings).toHaveBeenCalledOnce();
  });

  it("logs a message when rankings are refreshed", async () => {
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce([]);

    await importGames(
      { start_year: 2020, end_year: 2020, min_rating_count: 5 },
      fetcher,
      db,
      (msg) => logs.push(msg),
    );

    expect(logs.some((l) => l.toLowerCase().includes("ranking"))).toBe(true);
  });

  it("saves progress after each completed year", async () => {
    const fetcher: IgdbFetcher = vi
      .fn()
      .mockResolvedValueOnce([makeGame({ id: 1 })])
      .mockResolvedValueOnce([makeGame({ id: 2 })]);

    await importGames(
      { start_year: 2000, end_year: 2001, min_rating_count: 5 },
      fetcher,
      db,
      () => {},
    );

    expect(db.saveImportProgress).toHaveBeenCalledTimes(2);
    expect(db.saveImportProgress).toHaveBeenNthCalledWith(1, 2000);
    expect(db.saveImportProgress).toHaveBeenNthCalledWith(2, 2001);
  });

  it("resumes from the year after the last completed year", async () => {
    const dbWithProgress = makeMockDb({
      getImportProgress: vi.fn((): Promise<number | null> => Promise.resolve(2001)),
    });
    const fetcher: IgdbFetcher = vi.fn().mockResolvedValueOnce([makeGame({ id: 3 })]);

    const result = await importGames(
      { start_year: 2000, end_year: 2002, min_rating_count: 5 },
      fetcher,
      dbWithProgress,
      (msg) => logs.push(msg),
    );

    // Should only process 2002 (2000 and 2001 were already done)
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.years).toHaveLength(1);
    expect(result.years[0]?.year).toBe(2002);
    expect(logs.some((l) => l.includes("Resuming from year 2002"))).toBe(true);
  });

  it("returns empty result when all years already completed", async () => {
    const dbWithProgress = makeMockDb({
      getImportProgress: vi.fn((): Promise<number | null> => Promise.resolve(2025)),
    });
    const fetcher: IgdbFetcher = vi.fn();

    const result = await importGames(
      { start_year: 2020, end_year: 2025, min_rating_count: 5 },
      fetcher,
      dbWithProgress,
      (msg) => logs.push(msg),
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.total_imported).toBe(0);
    expect(result.years).toHaveLength(0);
    expect(logs.some((l) => l.includes("nothing to do"))).toBe(true);
  });

  it("does not resume when resume: false is passed", async () => {
    const dbWithProgress = makeMockDb({
      getImportProgress: vi.fn((): Promise<number | null> => Promise.resolve(2001)),
    });
    const fetcher: IgdbFetcher = vi
      .fn()
      .mockResolvedValueOnce([makeGame({ id: 1 })])
      .mockResolvedValueOnce([makeGame({ id: 2 })]);

    const result = await importGames(
      { start_year: 2000, end_year: 2001, min_rating_count: 5, resume: false },
      fetcher,
      dbWithProgress,
      () => {},
    );

    // Should process both years even though 2001 was "completed"
    expect(result.years).toHaveLength(2);
    expect(dbWithProgress.getImportProgress).not.toHaveBeenCalled();
    expect(dbWithProgress.saveImportProgress).not.toHaveBeenCalled();
  });
});
