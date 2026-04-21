/**
 * Tests for the pure streak computation logic.
 * No I/O — plain TypeScript functions.
 */

import { describe, expect, it } from "vitest";
import { computeStreakUpdate, getYesterday } from "../../../supabase/functions/_shared/streak";
import type { StreakRow } from "../../../supabase/functions/_shared/streak";

// ---------------------------------------------------------------------------
// getYesterday
// ---------------------------------------------------------------------------

describe("getYesterday", () => {
  it("returns the day before a mid-month date", () => {
    expect(getYesterday("2026-05-15")).toBe("2026-05-14");
  });

  it("wraps correctly at month boundary", () => {
    expect(getYesterday("2026-06-01")).toBe("2026-05-31");
  });

  it("wraps correctly at year boundary", () => {
    expect(getYesterday("2026-01-01")).toBe("2025-12-31");
  });

  it("handles leap-year February", () => {
    expect(getYesterday("2024-03-01")).toBe("2024-02-29");
  });
});

// ---------------------------------------------------------------------------
// computeStreakUpdate — first play (no existing row)
// ---------------------------------------------------------------------------

describe("computeStreakUpdate — first play", () => {
  it("sets current_streak to 1 when no existing row", () => {
    const result = computeStreakUpdate(null, "2026-05-01");
    expect(result.current_streak).toBe(1);
  });

  it("sets best_streak to 1 when no existing row", () => {
    const result = computeStreakUpdate(null, "2026-05-01");
    expect(result.best_streak).toBe(1);
  });

  it("sets last_played to today when no existing row", () => {
    const result = computeStreakUpdate(null, "2026-05-01");
    expect(result.last_played).toBe("2026-05-01");
  });
});

// ---------------------------------------------------------------------------
// computeStreakUpdate — streak continues (last_played == yesterday)
// ---------------------------------------------------------------------------

describe("computeStreakUpdate — streak continues", () => {
  const existing: StreakRow = { current_streak: 5, best_streak: 7, last_played: "2026-05-14" };
  const today = "2026-05-15";

  it("increments current_streak by 1", () => {
    expect(computeStreakUpdate(existing, today).current_streak).toBe(6);
  });

  it("keeps best_streak unchanged when new streak does not exceed it", () => {
    expect(computeStreakUpdate(existing, today).best_streak).toBe(7);
  });

  it("updates best_streak when new streak exceeds it", () => {
    const row: StreakRow = { current_streak: 7, best_streak: 7, last_played: "2026-05-14" };
    expect(computeStreakUpdate(row, today).best_streak).toBe(8);
  });

  it("sets last_played to today", () => {
    expect(computeStreakUpdate(existing, today).last_played).toBe(today);
  });
});

// ---------------------------------------------------------------------------
// computeStreakUpdate — streak broken (last_played is not yesterday)
// ---------------------------------------------------------------------------

describe("computeStreakUpdate — streak broken", () => {
  it("resets current_streak to 1 when last_played was two days ago", () => {
    const existing: StreakRow = { current_streak: 10, best_streak: 10, last_played: "2026-05-13" };
    expect(computeStreakUpdate(existing, "2026-05-15").current_streak).toBe(1);
  });

  it("resets current_streak to 1 when last_played was a long time ago", () => {
    const existing: StreakRow = { current_streak: 42, best_streak: 42, last_played: "2026-01-01" };
    expect(computeStreakUpdate(existing, "2026-05-15").current_streak).toBe(1);
  });

  it("keeps best_streak unchanged after reset", () => {
    const existing: StreakRow = { current_streak: 10, best_streak: 15, last_played: "2026-05-01" };
    expect(computeStreakUpdate(existing, "2026-05-15").best_streak).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// computeStreakUpdate — idempotent (last_played == today)
// ---------------------------------------------------------------------------

describe("computeStreakUpdate — already played today", () => {
  const today = "2026-05-15";
  const existing: StreakRow = { current_streak: 3, best_streak: 5, last_played: today };

  it("leaves current_streak unchanged", () => {
    expect(computeStreakUpdate(existing, today).current_streak).toBe(3);
  });

  it("leaves best_streak unchanged", () => {
    expect(computeStreakUpdate(existing, today).best_streak).toBe(5);
  });

  it("keeps last_played as today", () => {
    expect(computeStreakUpdate(existing, today).last_played).toBe(today);
  });
});
