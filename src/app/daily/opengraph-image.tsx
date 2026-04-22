// SPDX-License-Identifier: AGPL-3.0-only
import { ImageResponse } from "next/og";

export const alt = "Game Guesser Daily Challenge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function fetchChallengeNumber(): Promise<number | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (typeof supabaseUrl !== "string" || typeof supabaseKey !== "string") return null;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_challenges?select=challenge_number&challenge_date=eq.${today}&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ challenge_number: number }>;
    return data[0]?.challenge_number ?? null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const challengeNumber = await fetchChallengeNumber();
  const subtitle =
    challengeNumber !== null
      ? `Daily Challenge #${String(challengeNumber)}`
      : "Daily Challenge";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: "#a78bfa",
            letterSpacing: "-2px",
          }}
        >
          Game Guesser
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#e2e8f0",
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#94a3b8",
            marginTop: 16,
          }}
        >
          Place all 10 games on the timeline
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#64748b",
          }}
        >
          gameguesser.com/daily
        </div>
      </div>
    ),
    { ...size },
  );
}
