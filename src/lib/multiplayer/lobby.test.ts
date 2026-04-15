// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOBBY_SETTINGS,
  DisplayNameSchema,
  generateRoomCode,
  LobbyPresenceSchema,
  LobbySettingsSchema,
  RoomCodeSchema,
} from "./lobby";

describe("generateRoomCode", () => {
  it("returns six uppercase characters from the allowed alphabet", () => {
    const roomCode = generateRoomCode();

    expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(roomCode).toHaveLength(6);
  });

  it("produces more than one value across a sample of generated codes", () => {
    const roomCodes = Array.from({ length: 64 }, () => generateRoomCode());

    expect(new Set(roomCodes).size).toBeGreaterThan(1);
  });
});

describe("RoomCodeSchema", () => {
  it("normalizes lowercase input to uppercase", () => {
    const parsed = RoomCodeSchema.parse("ab2cd3");

    expect(parsed).toBe("AB2CD3");
  });

  it("rejects invalid characters", () => {
    const parsed = RoomCodeSchema.safeParse("A1BCDE");

    expect(parsed.success).toBe(false);
  });

  it("rejects room codes with the wrong length", () => {
    const parsed = RoomCodeSchema.safeParse("ABCDE");

    expect(parsed.success).toBe(false);
  });
});

describe("LobbySettingsSchema", () => {
  it("applies the researched defaults", () => {
    const parsed = LobbySettingsSchema.parse({});

    expect(parsed).toEqual(DEFAULT_LOBBY_SETTINGS);
    expect(parsed).toEqual({
      difficulty: "easy",
      turnTimer: "60",
      tokensEnabled: true,
      startingTokens: 2,
      winCondition: 10,
      gameMode: "competitive",
      variant: "standard",
      genreLockId: null,
      consoleLockFamily: null,
      decadeStart: null,
      speedRound: false,
    });
  });

  it("accepts valid explicit settings", () => {
    const parsed = LobbySettingsSchema.parse({
      difficulty: "hard",
      turnTimer: "unlimited",
      tokensEnabled: false,
      startingTokens: 0,
      winCondition: 20,
      gameMode: "competitive",
      variant: "expert",
      genreLockId: null,
      consoleLockFamily: null,
      decadeStart: null,
      speedRound: false,
    });

    expect(parsed).toEqual({
      difficulty: "hard",
      turnTimer: "unlimited",
      tokensEnabled: false,
      startingTokens: 0,
      winCondition: 20,
      gameMode: "competitive",
      variant: "expert",
      genreLockId: null,
      consoleLockFamily: null,
      decadeStart: null,
      speedRound: false,
    });
  });

  it("accepts teamwork gameMode", () => {
    const parsed = LobbySettingsSchema.safeParse({ gameMode: "teamwork" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gameMode).toBe("teamwork");
    }
  });

  it("accepts turnTimer of 10 for speed round", () => {
    const parsed = LobbySettingsSchema.safeParse({ turnTimer: "10" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.turnTimer).toBe("10");
    }
  });

  it("accepts house rule fields", () => {
    const parsed = LobbySettingsSchema.safeParse({
      genreLockId: 12,
      consoleLockFamily: "nintendo",
      decadeStart: 1990,
      speedRound: true,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.genreLockId).toBe(12);
      expect(parsed.data.consoleLockFamily).toBe("nintendo");
      expect(parsed.data.decadeStart).toBe(1990);
      expect(parsed.data.speedRound).toBe(true);
    }
  });

  it("rejects invalid settings values", () => {
    const parsed = LobbySettingsSchema.safeParse({
      difficulty: "impossible",
      turnTimer: "15",
      tokensEnabled: true,
      startingTokens: 11,
      winCondition: 21,
      variant: "chaos",
      gameMode: "solo",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("LobbyPresenceSchema — joinedAt datetime offset", () => {
  const basePresence = {
    userId: "00000000-0000-4000-8000-000000000001",
    displayName: "Alex",
    role: "player",
    status: "connected",
  };

  it("accepts a Supabase PostgREST +00:00 offset timestamp", () => {
    const parsed = LobbyPresenceSchema.safeParse({
      ...basePresence,
      joinedAt: "2026-04-12T13:33:20.123456+00:00",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a UTC Z-suffix timestamp", () => {
    const parsed = LobbyPresenceSchema.safeParse({
      ...basePresence,
      joinedAt: "2026-04-12T13:33:20Z",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a timestamp without any offset", () => {
    const parsed = LobbyPresenceSchema.safeParse({
      ...basePresence,
      joinedAt: "2026-04-12T13:33:20",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("DisplayNameSchema", () => {
  it("trims and collapses whitespace", () => {
    const parsed = DisplayNameSchema.parse("   Alex    The   Great   ");

    expect(parsed).toBe("Alex The Great");
  });

  it("rejects display names that are too short after normalization", () => {
    const parsed = DisplayNameSchema.safeParse("   ");

    expect(parsed.success).toBe(false);
  });

  it("rejects disallowed punctuation", () => {
    const parsed = DisplayNameSchema.safeParse("Alex!");

    expect(parsed.success).toBe(false);
  });
});
