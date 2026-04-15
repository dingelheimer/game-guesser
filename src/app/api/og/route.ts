// SPDX-License-Identifier: AGPL-3.0-only
import { ImageResponse } from "next/og";
import { createElement, type CSSProperties, type ReactElement } from "react";
import { getSoloDifficultyLabel } from "@/lib/solo/share";
import { decodeShareResultPayload } from "@/lib/shareResult";
import { siteConfig } from "@/lib/site";

export const runtime = "edge";

const OG_IMAGE_SIZE = {
  height: 630,
  width: 1200,
} as const;

const OUTCOME_COLORS = {
  close: "#facc15",
  correct: "#4ade80",
  wrong: "#fb7185",
} as const;

function buildOgResponse(content: ReactElement): ImageResponse {
  const response = new ImageResponse(content, OG_IMAGE_SIZE);
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return response;
}

function createBlock(
  style: CSSProperties,
  ...children: Array<ReactElement | string | null>
): ReactElement {
  return createElement("div", { style }, ...children.filter((child) => child !== null));
}

/**
 * Generate a dynamic Open Graph image for a stateless shared result URL.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encodedPayload = searchParams.get("d");
  const result = decodeShareResultPayload(encodedPayload);

  if (result === null) {
    return buildOgResponse(
      createBlock(
        {
          alignItems: "center",
          background:
            "radial-gradient(circle at top left, rgba(99,102,241,0.35), transparent 32%), #09090f",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: 56,
          width: "100%",
        },
        createBlock(
          { color: "#a5b4fc", fontSize: 28, fontWeight: 700, letterSpacing: 6 },
          siteConfig.name.toUpperCase(),
        ),
        createBlock(
          { fontSize: 72, fontWeight: 800, marginTop: 28, textAlign: "center" },
          "Result not found",
        ),
        createBlock(
          {
            color: "#cbd5e1",
            fontSize: 28,
            marginTop: 18,
            maxWidth: 760,
            textAlign: "center",
          },
          "Start a fresh round and share a new score card from the game-over screen.",
        ),
      ),
    );
  }

  const modeLabel = result.mode === "solo" ? "SOLO" : "MULTIPLAYER";

  return buildOgResponse(
    createBlock(
      {
        background:
          "radial-gradient(circle at top left, rgba(99,102,241,0.38), transparent 30%), radial-gradient(circle at bottom right, rgba(34,197,94,0.22), transparent 28%), #09090f",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: 48,
        width: "100%",
      },
      createBlock(
        { display: "flex", justifyContent: "space-between" },
        createBlock(
          { display: "flex", flexDirection: "column" },
          createBlock(
            { color: "#a5b4fc", fontSize: 24, fontWeight: 700, letterSpacing: 6 },
            siteConfig.name.toUpperCase(),
          ),
          createBlock({ fontSize: 68, fontWeight: 800, marginTop: 20 }, `${modeLabel} RESULT`),
          createBlock(
            { color: "#cbd5e1", fontSize: 28, marginTop: 18 },
            `${getSoloDifficultyLabel(result.difficulty)} difficulty`,
          ),
        ),
        createBlock(
          {
            alignItems: "center",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 32,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minWidth: 240,
            padding: "28px 32px",
          },
          createBlock({ color: "#cbd5e1", fontSize: 20, letterSpacing: 2 }, "SCORE"),
          createBlock(
            { fontSize: 56, fontWeight: 800, marginTop: 12 },
            `${String(result.score)}/${String(result.turnsPlayed)}`,
          ),
        ),
      ),
      createBlock(
        {
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          marginTop: 32,
        },
        ...result.outcomes.map((outcome, index) =>
          createElement("div", {
            key: `${outcome}-${String(index)}`,
            style: {
              background: OUTCOME_COLORS[outcome],
              borderRadius: 12,
              boxShadow: `0 0 24px ${OUTCOME_COLORS[outcome]}55`,
              height: 44,
              width: 44,
            },
          }),
        ),
      ),
      createBlock(
        { display: "flex", justifyContent: "space-between", marginTop: 24 },
        createBlock(
          { display: "flex", flexDirection: "column", gap: 12 },
          createBlock(
            { color: "#cbd5e1", fontSize: 24 },
            `Years ${String(result.yearRange.start)} → ${String(result.yearRange.end)}`,
          ),
          createBlock(
            { color: "#cbd5e1", fontSize: 24 },
            `Platform bonus ${String(result.platformBonusEarned)}/${String(result.platformBonusOpportunities)}`,
          ),
          result.mode === "multiplayer" &&
            result.placement !== undefined &&
            result.playerCount !== undefined
            ? createBlock(
                { color: "#cbd5e1", fontSize: 24 },
                `Finished #${String(result.placement)} of ${String(result.playerCount)} players`,
              )
            : null,
        ),
        createBlock(
          {
            alignItems: "center",
            alignSelf: "flex-end",
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(165,180,252,0.35)",
            borderRadius: 9999,
            color: "#e2e8f0",
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            justifyContent: "center",
            padding: "14px 24px",
          },
          "Can you beat this?",
        ),
      ),
    ),
  );
}
