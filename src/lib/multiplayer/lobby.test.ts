import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOBBY_SETTINGS,
  DisplayNameSchema,
  generateRoomCode,
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
      variant: "standard",
    });
  });

  it("accepts valid explicit settings", () => {
    const parsed = LobbySettingsSchema.parse({
      difficulty: "hard",
      turnTimer: "unlimited",
      tokensEnabled: false,
      startingTokens: 0,
      winCondition: 20,
      variant: "expert",
    });

    expect(parsed).toEqual({
      difficulty: "hard",
      turnTimer: "unlimited",
      tokensEnabled: false,
      startingTokens: 0,
      winCondition: 20,
      variant: "expert",
    });
  });

  it("rejects invalid settings values", () => {
    const parsed = LobbySettingsSchema.safeParse({
      difficulty: "impossible",
      turnTimer: "15",
      tokensEnabled: true,
      startingTokens: 11,
      winCondition: 21,
      variant: "chaos",
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
