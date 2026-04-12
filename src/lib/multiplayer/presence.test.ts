import type { RealtimePresenceState } from "@supabase/realtime-js";
import { describe, expect, it } from "vitest";
import { buildConnectedPresence, buildSeedPresence } from "./presence";
import type { PresencePlayer } from "./presence";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const PLAYER_ID = "22222222-2222-4222-8222-222222222222";
const NEW_PLAYER_ID = "33333333-3333-4333-8333-333333333333";
const LATE_PLAYER_ID = "44444444-4444-4444-8444-444444444444";

const hostPlayer: PresencePlayer = {
  displayName: "Alex Host" as PresencePlayer["displayName"],
  joinedAt: "2026-04-12T10:00:00.000Z",
  role: "host",
  userId: HOST_ID,
};

const knownPlayer: PresencePlayer = {
  displayName: "Sam Player" as PresencePlayer["displayName"],
  joinedAt: "2026-04-12T10:01:00.000Z",
  role: "player",
  userId: PLAYER_ID,
};

function makePresenceState(
  entries: Array<Record<string, unknown>>,
): RealtimePresenceState<Record<string, unknown>> {
  return Object.fromEntries(
    entries.map((e, i) => [String(i), [e]]),
  ) as RealtimePresenceState<Record<string, unknown>>;
}

describe("buildSeedPresence", () => {
  it("maps every player to a connected LobbyPresence entry", () => {
    const result = buildSeedPresence([hostPlayer, knownPlayer]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ userId: HOST_ID, status: "connected" });
    expect(result[1]).toMatchObject({ userId: PLAYER_ID, status: "connected" });
  });
});

describe("buildConnectedPresence", () => {
  it("returns known players with DB snapshot values taking precedence", () => {
    const rawState = makePresenceState([
      {
        userId: HOST_ID,
        displayName: "Stale Name",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T09:00:00.000Z",
      },
    ]);

    const result = buildConnectedPresence([hostPlayer], rawState);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: HOST_ID,
      displayName: "Alex Host",
      role: "host",
      joinedAt: "2026-04-12T10:00:00.000Z",
    });
  });

  it("includes unknown players (not in initial list) using Presence payload values", () => {
    const rawState = makePresenceState([
      {
        userId: HOST_ID,
        displayName: "Alex Host",
        role: "host",
        status: "connected",
        joinedAt: "2026-04-12T10:00:00.000Z",
      },
      {
        userId: NEW_PLAYER_ID,
        displayName: "New Joiner",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T10:05:00.000Z",
      },
    ]);

    const result = buildConnectedPresence([hostPlayer], rawState);

    expect(result).toHaveLength(2);
    const newEntry = result.find((p) => p.userId === NEW_PLAYER_ID);
    expect(newEntry).toMatchObject({
      userId: NEW_PLAYER_ID,
      displayName: "New Joiner",
      role: "player",
      status: "connected",
      joinedAt: "2026-04-12T10:05:00.000Z",
    });
  });

  it("discards Presence entries that fail schema validation (ghost-filtering preserved)", () => {
    const rawState = makePresenceState([
      {
        userId: HOST_ID,
        displayName: "Alex Host",
        role: "host",
        status: "connected",
        joinedAt: "2026-04-12T10:00:00.000Z",
      },
      { userId: "not-a-uuid", displayName: "Ghost" },
    ]);

    const result = buildConnectedPresence([hostPlayer], rawState);

    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe(HOST_ID);
  });

  it("sorts known players before unknown players", () => {
    const rawState = makePresenceState([
      {
        userId: NEW_PLAYER_ID,
        displayName: "New Joiner",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T10:05:00.000Z",
      },
      {
        userId: HOST_ID,
        displayName: "Alex Host",
        role: "host",
        status: "connected",
        joinedAt: "2026-04-12T10:00:00.000Z",
      },
      {
        userId: PLAYER_ID,
        displayName: "Sam Player",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T10:01:00.000Z",
      },
    ]);

    const result = buildConnectedPresence([hostPlayer, knownPlayer], rawState);

    expect(result.map((p) => p.userId)).toEqual([HOST_ID, PLAYER_ID, NEW_PLAYER_ID]);
  });

  it("sorts multiple unknown players by joinedAt ascending", () => {
    const rawState = makePresenceState([
      {
        userId: LATE_PLAYER_ID,
        displayName: "Late Joiner",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T10:10:00.000Z",
      },
      {
        userId: NEW_PLAYER_ID,
        displayName: "New Joiner",
        role: "player",
        status: "connected",
        joinedAt: "2026-04-12T10:05:00.000Z",
      },
      {
        userId: HOST_ID,
        displayName: "Alex Host",
        role: "host",
        status: "connected",
        joinedAt: "2026-04-12T10:00:00.000Z",
      },
    ]);

    const result = buildConnectedPresence([hostPlayer], rawState);

    expect(result.map((p) => p.userId)).toEqual([HOST_ID, NEW_PLAYER_ID, LATE_PLAYER_ID]);
  });
});
