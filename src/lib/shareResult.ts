import { z } from "zod";
import type { DifficultyTier } from "@/lib/difficulty";
import { getSiteUrl } from "@/lib/site";
import type { ShareOutcome, ShareYearRange } from "@/lib/share";

const SHARE_OUTCOME_CODES = {
  close: "l",
  correct: "c",
  wrong: "w",
} as const;

const SHARE_OUTCOME_EMOJI: Record<ShareOutcome, string> = {
  close: "🟨",
  correct: "🟩",
  wrong: "🟥",
};

const SHARE_MODE_CODES = {
  multiplayer: "m",
  solo: "s",
} as const;

const CODE_TO_SHARE_MODE = {
  m: "multiplayer",
  s: "solo",
} as const;

const CompactShareResultPayloadSchema = z
  .object({
    d: z.enum(["easy", "medium", "hard", "extreme"]),
    m: z.enum(["s", "m"]),
    o: z
      .string()
      .regex(/^[clw]+$/u)
      .max(128),
    p: z.tuple([z.number().int().min(0).max(999), z.number().int().min(0).max(999)]),
    r: z.tuple([z.number().int().min(1).max(99), z.number().int().min(1).max(99)]).optional(),
    s: z.number().int().min(0).max(999),
    t: z.number().int().min(1).max(128),
    y: z.tuple([z.number().int().min(1970).max(2100), z.number().int().min(1970).max(2100)]),
  })
  .superRefine((value, ctx) => {
    if (value.o.length !== value.t) {
      ctx.addIssue({
        code: "custom",
        message: "Turn count must match the encoded outcome count.",
        path: ["t"],
      });
    }

    if (value.p[0] > value.p[1]) {
      ctx.addIssue({
        code: "custom",
        message: "Platform bonus earned cannot exceed total opportunities.",
        path: ["p"],
      });
    }

    if (value.y[0] > value.y[1]) {
      ctx.addIssue({
        code: "custom",
        message: "Year range must be ordered from earliest to latest.",
        path: ["y"],
      });
    }

    if (value.m === "s" && value.r !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Solo payloads cannot include multiplayer placement data.",
        path: ["r"],
      });
    }

    if (value.r !== undefined && value.r[0] > value.r[1]) {
      ctx.addIssue({
        code: "custom",
        message: "Placement cannot exceed player count.",
        path: ["r"],
      });
    }
  });

/**
 * A decoded stateless result payload used by the share URL, results page, and OG image route.
 */
export type ShareResultPayload = Readonly<{
  difficulty: DifficultyTier;
  mode: "solo" | "multiplayer";
  outcomes: readonly ShareOutcome[];
  platformBonusEarned: number;
  platformBonusOpportunities: number;
  placement?: number;
  playerCount?: number;
  score: number;
  turnsPlayed: number;
  yearRange: ShareYearRange;
}>;

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);

  const base64 =
    typeof btoa === "function"
      ? btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
      : Buffer.from(bytes).toString("base64");

  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary =
      typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function decodeOutcomeCode(code: string): ShareOutcome | null {
  switch (code) {
    case "c":
      return "correct";
    case "l":
      return "close";
    case "w":
      return "wrong";
    default:
      return null;
  }
}

function toCompactShareResultPayload(payload: ShareResultPayload) {
  return CompactShareResultPayloadSchema.parse({
    d: payload.difficulty,
    m: SHARE_MODE_CODES[payload.mode],
    o: payload.outcomes.map((outcome) => SHARE_OUTCOME_CODES[outcome]).join(""),
    p: [payload.platformBonusEarned, payload.platformBonusOpportunities],
    ...(payload.placement !== undefined && payload.playerCount !== undefined
      ? { r: [payload.placement, payload.playerCount] }
      : {}),
    s: payload.score,
    t: payload.turnsPlayed,
    y: [payload.yearRange.start, payload.yearRange.end],
  });
}

/**
 * Render the spoiler-free placement grid used by share text and result pages.
 */
export function formatShareOutcomeGrid(outcomes: readonly ShareOutcome[]): string {
  return outcomes.map((outcome) => SHARE_OUTCOME_EMOJI[outcome]).join("");
}

/**
 * Render the platform-bonus summary line used across share surfaces.
 */
export function formatPlatformBonusSummary(earned: number, opportunities: number): string {
  return `🎯 Platform bonus: ${String(Math.max(0, earned))}/${String(Math.max(0, opportunities))}`;
}

/**
 * Encode a stateless share result payload into a compact base64url string.
 */
export function encodeShareResultPayload(payload: ShareResultPayload): string {
  return encodeBase64Url(JSON.stringify(toCompactShareResultPayload(payload)));
}

/**
 * Decode and validate a stateless share result payload from the `d` query parameter.
 */
export function decodeShareResultPayload(
  encodedPayload: string | null | undefined,
): ShareResultPayload | null {
  if (encodedPayload === null || encodedPayload === undefined || encodedPayload.length === 0) {
    return null;
  }

  const decoded = decodeBase64Url(encodedPayload);
  if (decoded === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;
    const result = CompactShareResultPayloadSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }

    const outcomes: ShareOutcome[] = [];
    for (const code of result.data.o) {
      const outcome = decodeOutcomeCode(code);
      if (outcome === null) {
        return null;
      }

      outcomes.push(outcome);
    }

    return {
      difficulty: result.data.d,
      mode: CODE_TO_SHARE_MODE[result.data.m],
      outcomes,
      platformBonusEarned: result.data.p[0],
      platformBonusOpportunities: result.data.p[1],
      score: result.data.s,
      turnsPlayed: result.data.t,
      yearRange: {
        end: result.data.y[1],
        start: result.data.y[0],
      },
      ...(result.data.r === undefined
        ? {}
        : {
            placement: result.data.r[0],
            playerCount: result.data.r[1],
          }),
    };
  } catch {
    return null;
  }
}

/**
 * Build the public share URL for a stateless game result.
 */
export function buildShareResultUrl(payload: ShareResultPayload): string {
  return getSiteUrl(`/results?d=${encodeURIComponent(encodeShareResultPayload(payload))}`);
}
