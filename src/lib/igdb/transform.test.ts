import { describe, expect, it } from "vitest";
import {
  buildImportQuery,
  IGDB_PAGE_SIZE,
  transformCover,
  transformGame,
  transformGenre,
  transformPlatform,
  transformScreenshots,
} from "../../../supabase/functions/import-games/logic/transform";

// ---------------------------------------------------------------------------
// transformGame
// ---------------------------------------------------------------------------

describe("transformGame", () => {
  it("transforms a complete game record", () => {
    const result = transformGame({
      id: 1942,
      name: "The Legend of Zelda: Ocarina of Time",
      slug: "the-legend-of-zelda-ocarina-of-time",
      first_release_date: 912297600, // 1998-11-29 UTC
      summary: "A classic adventure game",
      rating: 97.5,
      rating_count: 3000,
      total_rating: 97.2,
      total_rating_count: 4500,
      follows: 12000,
      hypes: 100,
      updated_at: 1700000000,
    });

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.igdb_id).toBe(1942);
    expect(result.name).toBe("The Legend of Zelda: Ocarina of Time");
    expect(result.slug).toBe("the-legend-of-zelda-ocarina-of-time");
    expect(result.first_release_date).toBe("1998-11-29");
    expect(result.release_year).toBe(1998);
    expect(result.summary).toBe("A classic adventure game");
    expect(result.rating).toBe(97.5);
    expect(result.rating_count).toBe(3000);
    expect(result.total_rating).toBe(97.2);
    expect(result.total_rating_count).toBe(4500);
    expect(result.follows).toBe(12000);
    expect(result.hypes).toBe(100);
    expect(result.igdb_updated_at).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it("uses 0 as default for missing count and engagement fields", () => {
    const result = transformGame({
      id: 1,
      name: "Minimal Game",
      first_release_date: 946684800, // 2000-01-01 UTC
    });

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.rating_count).toBe(0);
    expect(result.total_rating_count).toBe(0);
    expect(result.follows).toBe(0);
    expect(result.hypes).toBe(0);
  });

  it("uses null for missing optional fields", () => {
    const result = transformGame({
      id: 1,
      name: "Minimal Game",
      first_release_date: 946684800,
    });

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.rating).toBeNull();
    expect(result.total_rating).toBeNull();
    expect(result.slug).toBeNull();
    expect(result.summary).toBeNull();
    expect(result.igdb_updated_at).toBeNull();
  });

  it("returns null when name is missing", () => {
    expect(transformGame({ id: 1, first_release_date: 946684800 })).toBeNull();
  });

  it("returns null when first_release_date is missing", () => {
    expect(transformGame({ id: 1, name: "Game" })).toBeNull();
  });

  it("correctly derives release_year and date from unix timestamp", () => {
    // 1985-09-13 UTC = 495417600
    const result = transformGame({
      id: 1,
      name: "Super Mario Bros.",
      first_release_date: 495417600,
    });
    expect(result?.release_year).toBe(1985);
    expect(result?.first_release_date).toBe("1985-09-13");
  });

  it("uses UTC dates (no timezone drift on Jan 1)", () => {
    // 2000-01-01 00:00:00 UTC = 946684800
    const result = transformGame({
      id: 1,
      name: "Y2K Game",
      first_release_date: 946684800,
    });
    expect(result?.release_year).toBe(2000);
    expect(result?.first_release_date).toBe("2000-01-01");
  });

  it("converts updated_at unix timestamp to ISO string", () => {
    const updatedAt = 1700000000;
    const result = transformGame({
      id: 1,
      name: "Game",
      first_release_date: 946684800,
      updated_at: updatedAt,
    });
    expect(result?.igdb_updated_at).toBe(new Date(updatedAt * 1000).toISOString());
  });
});

// ---------------------------------------------------------------------------
// transformPlatform
// ---------------------------------------------------------------------------

describe("transformPlatform", () => {
  it("transforms a platform with name", () => {
    expect(transformPlatform({ id: 48, name: "PlayStation 4" })).toEqual({
      igdb_id: 48,
      name: "PlayStation 4",
    });
  });

  it("returns null for platform without name", () => {
    expect(transformPlatform({ id: 48 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// transformGenre
// ---------------------------------------------------------------------------

describe("transformGenre", () => {
  it("transforms a genre with name", () => {
    expect(transformGenre({ id: 12, name: "Role-playing (RPG)" })).toEqual({
      igdb_id: 12,
      name: "Role-playing (RPG)",
    });
  });

  it("returns null for genre without name", () => {
    expect(transformGenre({ id: 12 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// transformCover
// ---------------------------------------------------------------------------

describe("transformCover", () => {
  it("transforms a cover with all fields", () => {
    expect(transformCover({ id: 100, image_id: "co1wyy", width: 264, height: 374 }, 42)).toEqual({
      game_id: 42,
      igdb_image_id: "co1wyy",
      width: 264,
      height: 374,
    });
  });

  it("uses null for missing dimension fields", () => {
    expect(transformCover({ id: 100, image_id: "co1wyy" }, 42)).toEqual({
      game_id: 42,
      igdb_image_id: "co1wyy",
      width: null,
      height: null,
    });
  });

  it("returns null when image_id is missing", () => {
    expect(transformCover({ id: 100, width: 264, height: 374 }, 42)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// transformScreenshots
// ---------------------------------------------------------------------------

describe("transformScreenshots", () => {
  it("transforms a list of screenshots with correct sort_order", () => {
    const result = transformScreenshots(
      [
        { id: 1, image_id: "sc1", width: 889, height: 500 },
        { id: 2, image_id: "sc2", width: 889, height: 500 },
      ],
      99,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      game_id: 99,
      igdb_image_id: "sc1",
      width: 889,
      height: 500,
      sort_order: 0,
    });
    expect(result[1]).toEqual({
      game_id: 99,
      igdb_image_id: "sc2",
      width: 889,
      height: 500,
      sort_order: 1,
    });
  });

  it("filters out screenshots without image_id", () => {
    const result = transformScreenshots(
      [{ id: 1, image_id: "sc1" }, { id: 2 }, { id: 3, image_id: "sc3" }],
      1,
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.igdb_image_id).toBe("sc1");
    expect(result[1]?.igdb_image_id).toBe("sc3");
  });

  it("assigns sequential sort_order after filtering missing image_ids", () => {
    const result = transformScreenshots(
      [
        { id: 1 }, // filtered out
        { id: 2, image_id: "sc2" },
        { id: 3, image_id: "sc3" },
      ],
      1,
    );
    expect(result[0]?.sort_order).toBe(0);
    expect(result[1]?.sort_order).toBe(1);
  });

  it("uses null for missing dimension fields", () => {
    const result = transformScreenshots([{ id: 1, image_id: "sc1" }], 5);
    expect(result[0]?.width).toBeNull();
    expect(result[0]?.height).toBeNull();
  });

  it("returns empty array for empty input", () => {
    expect(transformScreenshots([], 1)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildImportQuery
// ---------------------------------------------------------------------------

describe("buildImportQuery", () => {
  it("includes the correct year boundary timestamps", () => {
    const query = buildImportQuery(2005, 0, 10);
    // 2005-01-01 UTC = 1104537600
    // 2006-01-01 UTC = 1136073600
    expect(query).toContain("first_release_date >= 1104537600");
    expect(query).toContain("first_release_date < 1136073600");
  });

  it("applies the min_rating_count filter", () => {
    const query = buildImportQuery(2005, 0, 10);
    expect(query).toContain("rating_count >= 10");
  });

  it("includes the correct pagination offset", () => {
    expect(buildImportQuery(2005, 0, 5)).toContain("offset 0");
    expect(buildImportQuery(2005, 500, 5)).toContain("offset 500");
    expect(buildImportQuery(2005, 1000, 5)).toContain("offset 1000");
  });

  it("sets limit to IGDB_PAGE_SIZE", () => {
    expect(buildImportQuery(2010, 0, 0)).toContain(`limit ${String(IGDB_PAGE_SIZE)}`);
  });

  it("filters by game categories (main=0, remake=8, remaster=9)", () => {
    const query = buildImportQuery(2010, 0, 0);
    expect(query).toContain("category = null | category = 0 | category = 8 | category = 9");
  });

  it("requires cover and screenshots to be present", () => {
    const query = buildImportQuery(2010, 0, 0);
    expect(query).toContain("cover != null");
    expect(query).toContain("screenshots != null");
  });

  it("requests cover, screenshot, platform, and genre fields", () => {
    const query = buildImportQuery(2010, 0, 0);
    expect(query).toContain("cover.image_id");
    expect(query).toContain("screenshots.image_id");
    expect(query).toContain("platforms.name");
    expect(query).toContain("genres.name");
  });

  it("handles boundary year correctly (1985)", () => {
    const query = buildImportQuery(1985, 0, 0);
    // 1985-01-01 UTC = 473385600
    // 1986-01-01 UTC = 504921600
    expect(query).toContain("first_release_date >= 473385600");
    expect(query).toContain("first_release_date < 504921600");
  });
});

// ---------------------------------------------------------------------------
// IGDB_PAGE_SIZE
// ---------------------------------------------------------------------------

describe("IGDB_PAGE_SIZE", () => {
  it("equals 500 (IGDB API maximum per request)", () => {
    expect(IGDB_PAGE_SIZE).toBe(500);
  });
});
