// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  buildShareResultUrl,
  decodeShareResultPayload,
  encodeShareResultPayload,
} from "./shareResult";

describe("shareResult payload helpers", () => {
  it("encodes and decodes a compact multiplayer payload", () => {
    const encoded = encodeShareResultPayload({
      difficulty: "hard",
      mode: "multiplayer",
      outcomes: ["correct", "close", "wrong"],
      platformBonusEarned: 2,
      platformBonusOpportunities: 3,
      placement: 2,
      playerCount: 5,
      score: 4,
      turnsPlayed: 3,
      yearRange: { end: 2014, start: 1998 },
    });

    expect(decodeShareResultPayload(encoded)).toEqual({
      difficulty: "hard",
      mode: "multiplayer",
      outcomes: ["correct", "close", "wrong"],
      platformBonusEarned: 2,
      platformBonusOpportunities: 3,
      placement: 2,
      playerCount: 5,
      score: 4,
      turnsPlayed: 3,
      yearRange: { end: 2014, start: 1998 },
    });
  });

  it("returns null for invalid or corrupt payloads", () => {
    expect(decodeShareResultPayload("%%%")).toBeNull();
    expect(
      decodeShareResultPayload(
        "eyJkIjoiZWFzeSIsIm0iOiJzIiwibyI6ImMiLCJwIjpbMiwxXSwicyI6MSwidCI6MSwieSI6WzIwMDAsMjAwMF19",
      ),
    ).toBeNull();
  });

  it("builds a shareable result URL under the public results route", () => {
    const url = buildShareResultUrl({
      difficulty: "medium",
      mode: "solo",
      outcomes: ["correct", "wrong"],
      platformBonusEarned: 1,
      platformBonusOpportunities: 2,
      score: 1,
      turnsPlayed: 2,
      yearRange: { end: 2005, start: 1999 },
    });

    expect(url).toMatch(/^https:\/\/gameguesser\.com\/results\?d=/u);
  });
});
