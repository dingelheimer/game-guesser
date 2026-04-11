import { describe, expect, it } from "vitest";
import {
  buildPlatformOptions,
  maxDistractorsNeeded,
  MIN_OPTIONS,
  MAX_OPTIONS_NORMAL,
  MAX_OPTIONS_MANY,
} from "../../../supabase/functions/solo-turn/logic/platforms";
import type { PlatformOption } from "../../../supabase/functions/solo-turn/logic/platforms";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const platform = (id: number, name = `Platform ${id.toString()}`): PlatformOption => ({
  id,
  name,
});

const platforms = (ids: number[]): PlatformOption[] => ids.map((id) => platform(id));

/** Deterministic RNG that returns values from a fixed sequence. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

// ---------------------------------------------------------------------------
// maxDistractorsNeeded
// ---------------------------------------------------------------------------

describe("maxDistractorsNeeded", () => {
  it("returns MAX_OPTIONS_NORMAL - correctCount when correct < MIN_OPTIONS", () => {
    expect(maxDistractorsNeeded(1)).toBe(MAX_OPTIONS_NORMAL - 1); // 11
    expect(maxDistractorsNeeded(4)).toBe(MAX_OPTIONS_NORMAL - 4); // 8
    expect(maxDistractorsNeeded(7)).toBe(MAX_OPTIONS_NORMAL - 7); // 5
  });

  it("caps distractors at 4 when correctCount equals MIN_OPTIONS", () => {
    // MIN_OPTIONS = 8: min(4, 14-8) = min(4, 6) = 4 (capped by MAX_EXTRA_DISTRACTORS)
    expect(maxDistractorsNeeded(MIN_OPTIONS)).toBe(4);
    expect(maxDistractorsNeeded(MIN_OPTIONS)).toBeLessThanOrEqual(4);
  });

  it("caps distractors at 4 when correct >= MIN_OPTIONS", () => {
    expect(maxDistractorsNeeded(8)).toBeLessThanOrEqual(4);
    expect(maxDistractorsNeeded(10)).toBeLessThanOrEqual(4);
    expect(maxDistractorsNeeded(13)).toBeLessThanOrEqual(4);
  });

  it("returns 0 when there is no room for more options (14 correct)", () => {
    expect(maxDistractorsNeeded(14)).toBe(0);
    expect(maxDistractorsNeeded(20)).toBe(0);
  });

  it("never returns a negative value", () => {
    for (let i = 0; i <= 20; i++) {
      expect(maxDistractorsNeeded(i)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// buildPlatformOptions — correctIds
// ---------------------------------------------------------------------------

describe("buildPlatformOptions — correctIds", () => {
  it("includes all correct platform IDs", () => {
    const correct = platforms([10, 20, 30]);
    const distractors = platforms([40, 50, 60, 70, 80, 90, 100, 110, 120]);
    const { correctIds } = buildPlatformOptions(correct, distractors);
    expect(correctIds).toEqual([10, 20, 30]);
  });

  it("correct IDs are not affected by the shuffle", () => {
    const correct = platforms([1, 2]);
    const { correctIds } = buildPlatformOptions(correct, platforms([3, 4, 5, 6, 7, 8, 9, 10]));
    expect(correctIds).toHaveLength(2);
    expect(correctIds).toContain(1);
    expect(correctIds).toContain(2);
  });
});

// ---------------------------------------------------------------------------
// buildPlatformOptions — option count
// ---------------------------------------------------------------------------

describe("buildPlatformOptions — option count", () => {
  it("includes correct platforms + limited distractors (correctCount < MIN_OPTIONS)", () => {
    const correct = platforms([1]);
    // Provide 11 distractors (maxDistractorsNeeded(1) = 11)
    const distractors = platforms([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const { options } = buildPlatformOptions(correct, distractors);
    expect(options).toHaveLength(1 + 11); // 12
  });

  it("takes up to maxDistractorsNeeded distractors, ignores extras", () => {
    const correct = platforms([1, 2, 3]);
    const needed = maxDistractorsNeeded(3); // 9
    // Provide more than needed
    const distractors = platforms(Array.from({ length: needed + 5 }, (_, i) => i + 10));
    const { options } = buildPlatformOptions(correct, distractors);
    expect(options).toHaveLength(3 + needed);
  });

  it("uses fewer distractors when supply is limited", () => {
    const correct = platforms([1]);
    const distractors = platforms([10, 11, 12]); // only 3 available, need 11
    const { options } = buildPlatformOptions(correct, distractors);
    expect(options).toHaveLength(4); // 1 correct + 3 available
  });

  it("caps total to MAX_OPTIONS_MANY when correct >= MIN_OPTIONS", () => {
    // 10 correct → need 4 distractors, total = 14 = MAX_OPTIONS_MANY
    const correct = platforms(Array.from({ length: 10 }, (_, i) => i + 1));
    const distractors = platforms(Array.from({ length: 10 }, (_, i) => i + 100));
    const { options } = buildPlatformOptions(correct, distractors);
    expect(options.length).toBeLessThanOrEqual(MAX_OPTIONS_MANY);
  });
});

// ---------------------------------------------------------------------------
// buildPlatformOptions — shuffling
// ---------------------------------------------------------------------------

describe("buildPlatformOptions — shuffling", () => {
  it("all correct platform IDs appear in the options", () => {
    const correct = platforms([1, 2, 3]);
    const distractors = platforms([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    const { options, correctIds } = buildPlatformOptions(correct, distractors);
    for (const id of correctIds) {
      expect(options.map((o) => o.id)).toContain(id);
    }
  });

  it("produces deterministic output with a fixed RNG", () => {
    const correct = platforms([1, 2]);
    const distractors = platforms([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    const rng = seqRng([0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.15]);
    const { options: first } = buildPlatformOptions(correct, distractors, rng);
    const rng2 = seqRng([0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.15]);
    const { options: second } = buildPlatformOptions(correct, distractors, rng2);
    expect(first.map((o) => o.id)).toEqual(second.map((o) => o.id));
  });

  it("does not duplicate any platform in the options", () => {
    const correct = platforms([1, 2, 3]);
    const distractors = platforms([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    const { options } = buildPlatformOptions(correct, distractors);
    const ids = options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("works with zero distractors available", () => {
    const correct = platforms([1, 2, 3]);
    const { options, correctIds } = buildPlatformOptions(correct, []);
    expect(options).toHaveLength(3);
    expect(correctIds).toEqual([1, 2, 3]);
  });

  it("works with a single correct platform and no distractors", () => {
    const correct = platforms([42]);
    const { options, correctIds } = buildPlatformOptions(correct, []);
    expect(options).toHaveLength(1);
    expect(correctIds).toEqual([42]);
  });
});
