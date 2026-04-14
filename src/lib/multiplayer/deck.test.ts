import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDeck, difficultyToMaxRank, fisherYatesShuffle } from "./deck";

// ── fisherYatesShuffle ────────────────────────────────────────────────────────

describe("fisherYatesShuffle", () => {
  it("returns the same array reference", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = fisherYatesShuffle(arr);
    expect(result).toBe(arr);
  });

  it("preserves all elements", () => {
    const arr = [10, 20, 30, 40, 50];
    fisherYatesShuffle(arr);
    expect(arr).toHaveLength(5);
    expect(arr).toContain(10);
    expect(arr).toContain(20);
    expect(arr).toContain(30);
    expect(arr).toContain(40);
    expect(arr).toContain(50);
  });

  it("handles empty arrays", () => {
    const arr: number[] = [];
    expect(fisherYatesShuffle(arr)).toEqual([]);
  });

  it("handles single-element arrays", () => {
    const arr = [42];
    expect(fisherYatesShuffle(arr)).toEqual([42]);
  });
});

// ── difficultyToMaxRank ───────────────────────────────────────────────────────

describe("difficultyToMaxRank", () => {
  it("maps easy to 10", () => {
    expect(difficultyToMaxRank("easy")).toBe(10);
  });

  it("maps medium to 20", () => {
    expect(difficultyToMaxRank("medium")).toBe(20);
  });

  it("maps hard to 50", () => {
    expect(difficultyToMaxRank("hard")).toBe(50);
  });

  it("maps extreme to null (no limit)", () => {
    expect(difficultyToMaxRank("extreme")).toBeNull();
  });
});

// ── buildDeck ─────────────────────────────────────────────────────────────────

const mockRpc = vi.fn();
const mockServiceClient = { rpc: mockRpc } as unknown as Parameters<typeof buildDeck>[0];

describe("buildDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls build_deck RPC with correct max_rank for easy difficulty", async () => {
    mockRpc.mockResolvedValue({ data: [1, 2, 3], error: null });

    const result = await buildDeck(mockServiceClient, "easy");

    expect(mockRpc).toHaveBeenCalledWith("build_deck", { p_max_rank: 10 });
    expect(result).toEqual([1, 2, 3]);
  });

  it("calls build_deck RPC with correct max_rank for medium difficulty", async () => {
    mockRpc.mockResolvedValue({ data: [4, 5, 6], error: null });

    await buildDeck(mockServiceClient, "medium");

    expect(mockRpc).toHaveBeenCalledWith("build_deck", { p_max_rank: 20 });
  });

  it("calls build_deck RPC with correct max_rank for hard difficulty", async () => {
    mockRpc.mockResolvedValue({ data: [7, 8, 9], error: null });

    await buildDeck(mockServiceClient, "hard");

    expect(mockRpc).toHaveBeenCalledWith("build_deck", { p_max_rank: 50 });
  });

  it("calls build_deck RPC without p_max_rank for extreme difficulty", async () => {
    mockRpc.mockResolvedValue({ data: [10, 11, 12], error: null });

    await buildDeck(mockServiceClient, "extreme");

    expect(mockRpc).toHaveBeenCalledWith("build_deck", {});
  });

  it("includes p_genre_id when genreLockId is set", async () => {
    mockRpc.mockResolvedValue({ data: [1, 2, 3], error: null });

    await buildDeck(mockServiceClient, "easy", {
      genreLockId: 42,
      consoleLockFamily: null,
      decadeStart: null,
    });

    expect(mockRpc).toHaveBeenCalledWith("build_deck", { p_max_rank: 10, p_genre_id: 42 });
  });

  it("includes p_platform_family when consoleLockFamily is set", async () => {
    mockRpc.mockResolvedValue({ data: [1, 2, 3], error: null });

    await buildDeck(mockServiceClient, "medium", {
      genreLockId: null,
      consoleLockFamily: "nintendo",
      decadeStart: null,
    });

    expect(mockRpc).toHaveBeenCalledWith("build_deck", {
      p_max_rank: 20,
      p_platform_family: "nintendo",
    });
  });

  it("includes p_decade_start when decadeStart is set", async () => {
    mockRpc.mockResolvedValue({ data: [1, 2, 3], error: null });

    await buildDeck(mockServiceClient, "hard", {
      genreLockId: null,
      consoleLockFamily: null,
      decadeStart: 1990,
    });

    expect(mockRpc).toHaveBeenCalledWith("build_deck", { p_max_rank: 50, p_decade_start: 1990 });
  });

  it("includes all house rule params when all are set", async () => {
    mockRpc.mockResolvedValue({ data: [1, 2, 3], error: null });

    await buildDeck(mockServiceClient, "easy", {
      genreLockId: 5,
      consoleLockFamily: "playstation",
      decadeStart: 2000,
    });

    expect(mockRpc).toHaveBeenCalledWith("build_deck", {
      p_max_rank: 10,
      p_genre_id: 5,
      p_platform_family: "playstation",
      p_decade_start: 2000,
    });
  });

  it("returns the array of game IDs from the RPC", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => i + 1);
    mockRpc.mockResolvedValue({ data: ids, error: null });

    const result = await buildDeck(mockServiceClient, "hard");

    expect(result).toHaveLength(200);
    expect(result).toEqual(ids);
  });

  it("throws when the RPC returns an error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db error" } });

    await expect(buildDeck(mockServiceClient, "easy")).rejects.toThrow("Failed to build deck");
  });

  it("throws when the RPC returns null data", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(buildDeck(mockServiceClient, "easy")).rejects.toThrow("Failed to build deck");
  });
});
