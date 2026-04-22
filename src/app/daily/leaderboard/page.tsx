// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  fetchDailyLeaderboardServer,
  fetchDailyPlayerRankServer,
} from "@/lib/daily/leaderboard.server";
import { DailyLeaderboard } from "@/components/daily/DailyLeaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Leaderboard",
  description: "See how you rank against other players on today's daily challenge.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function utcDateString(offset = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatChallengeDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DailyLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const rawTab = params["tab"];
  const isYesterday = rawTab === "yesterday";
  const dateOffset = isYesterday ? -1 : 0;
  const targetDate = utcDateString(dateOffset);

  const supabase = await createClient();

  // Fetch challenge metadata and current user in parallel.
  const [{ data: challengeRow }, { data: userData }] = await Promise.all([
    supabase
      .from("daily_challenges")
      .select("challenge_number, challenge_date")
      .eq("challenge_date", targetDate)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const currentUserId = userData.user?.id ?? null;

  // Fetch leaderboard data (may be empty if challenge not generated yet).
  let entries: Awaited<ReturnType<typeof fetchDailyLeaderboardServer>> = [];
  let playerRankData: Awaited<ReturnType<typeof fetchDailyPlayerRankServer>> | null = null;

  if (challengeRow !== null) {
    const { challenge_number: cn } = challengeRow;
    const results = await Promise.allSettled([
      fetchDailyLeaderboardServer(cn, 50),
      currentUserId !== null
        ? fetchDailyPlayerRankServer(cn, currentUserId)
        : Promise.resolve(null),
    ]);
    if (results[0].status === "fulfilled") entries = results[0].value;
    if (results[1].status === "fulfilled") playerRankData = results[1].value;
  }

  // Check if player is in top 50 (so we don't show the separate rank banner).
  const playerInTop50 = currentUserId !== null && entries.some((e) => e.userId === currentUserId);
  const playerRankToShow = playerInTop50 ? null : playerRankData;

  const tabLabel = isYesterday ? "Yesterday" : "Today";
  const challengeLabel =
    challengeRow !== null
      ? `Daily #${String(challengeRow.challenge_number)} — ${formatChallengeDate(challengeRow.challenge_date)}`
      : `No challenge found for ${tabLabel.toLowerCase()}`;

  return (
    <div className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-sky-400" />
            <h1 className="font-display text-text-primary text-2xl font-bold">Daily Leaderboard</h1>
          </div>
          <p className="text-text-secondary text-sm">{challengeLabel}</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2">
          <Button
            asChild
            variant={isYesterday ? "outline" : "default"}
            size="sm"
            className="gap-1.5"
          >
            <Link href="/daily/leaderboard">Today</Link>
          </Button>
          <Button
            asChild
            variant={isYesterday ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
          >
            <Link href="/daily/leaderboard?tab=yesterday">Yesterday</Link>
          </Button>
        </div>

        {/* Play CTA */}
        {!isYesterday && (
          <Button asChild variant="outline" className="gap-2">
            <Link href="/daily">Play Today&apos;s Challenge</Link>
          </Button>
        )}

        {/* Leaderboard */}
        {challengeRow === null ? (
          <div className="border-border/50 bg-surface-800 rounded-2xl border p-10 text-center">
            <Trophy className="text-text-disabled mx-auto mb-3 h-10 w-10" />
            <p className="font-display text-text-primary mb-1 text-lg font-semibold">
              No challenge available
            </p>
            <p className="text-text-secondary text-sm">
              {isYesterday
                ? "No challenge was generated for yesterday."
                : "Today's challenge hasn't been generated yet. Check back soon!"}
            </p>
          </div>
        ) : (
          <DailyLeaderboard
            entries={entries}
            playerRank={playerRankToShow}
            currentUserId={currentUserId}
            totalCards={10}
          />
        )}
      </div>
    </div>
  );
}
