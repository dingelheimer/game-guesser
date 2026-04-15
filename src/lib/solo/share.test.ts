// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
import { getSoloDifficultyLabel } from "./share";

describe("getSoloDifficultyLabel", () => {
  it("returns the UI label for a difficulty tier", () => {
    expect(getSoloDifficultyLabel("extreme")).toBe("Extreme");
  });
});

void vi;
