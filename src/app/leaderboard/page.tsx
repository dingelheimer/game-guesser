import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
};

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${String(diffMin)} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${String(diffHr)} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay < 7) return `${String(diffDay)} day${diffDay === 1 ? "" : "s"} ago`;
  if (diffWeek < 5) return `${String(diffWeek)} week${diffWeek === 1 ? "" : "s"} ago`;
  if (diffMonth < 12) return `${String(diffMonth)} month${diffMonth === 1 ? "" : "s"} ago`;
  return `${String(diffYear)} year${diffYear === 1 ? "" : "s"} ago`;
}

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: userData }, { data: entries }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("leaderboard_entries")
      .select("id, user_id, score, created_at, profiles(username)")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  const currentUserId = userData.user?.id ?? null;

  return (
    <div className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="text-primary-400 h-6 w-6" />
            <h1 className="font-display text-text-primary text-2xl font-bold">Leaderboard</h1>
          </div>
          <p className="text-text-secondary text-sm">Top 50 scores across all players</p>
        </div>

        {/* Play Now CTA */}
        <Button asChild className="gap-2">
          <Link href="/play">
            <Gamepad2 className="h-4 w-4" />
            Play Now
          </Link>
        </Button>

        {/* Table or empty state */}
        {!entries || entries.length === 0 ? (
          <div className="border-border/50 bg-surface-800 rounded-2xl border p-10 text-center">
            <Trophy className="text-text-disabled mx-auto mb-3 h-10 w-10" />
            <p className="text-text-primary font-display mb-1 text-lg font-semibold">
              No scores yet
            </p>
            <p className="text-text-secondary mb-4 text-sm">
              Be the first to make it onto the leaderboard!
            </p>
            <Button asChild size="sm" className="gap-2">
              <Link href="/play">
                <Gamepad2 className="h-4 w-4" />
                Play Now
              </Link>
            </Button>
          </div>
        ) : (
          <div className="border-border/50 bg-surface-800 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-border/50 border-b">
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Rank</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Username</th>
                  <th className="text-text-secondary px-4 py-3 text-right font-medium">Score</th>
                  <th className="text-text-secondary px-4 py-3 text-right font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = currentUserId !== null && entry.user_id === currentUserId;
                  const username =
                    (entry.profiles as { username: string } | null)?.username ?? "Unknown";

                  return (
                    <tr
                      key={entry.id}
                      className={
                        isCurrentUser
                          ? "bg-primary-400/10"
                          : "hover:bg-surface-700/50 transition-colors"
                      }
                    >
                      <td className="text-text-secondary px-4 py-3 font-mono">{rankLabel(rank)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            isCurrentUser ? "text-primary-400 font-semibold" : "text-text-primary"
                          }
                        >
                          {username}
                          {isCurrentUser && (
                            <span className="text-primary-400 ml-1.5 text-xs font-normal">
                              (you)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="font-display text-text-primary px-4 py-3 text-right font-bold">
                        {entry.score}
                      </td>
                      <td className="text-text-secondary px-4 py-3 text-right">
                        {formatRelativeDate(entry.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
