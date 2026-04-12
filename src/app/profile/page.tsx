import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";
import { UsernameForm } from "./username-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError !== null || user === null) {
    redirect("/auth/login?next=/profile");
  }

  const [{ data: profile }, { data: bestEntry }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase
      .from("leaderboard_entries")
      .select("score")
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const username = profile?.username ?? "Unknown";
  const bestScore = bestEntry?.score ?? null;

  return (
    <div className="flex flex-1 items-start justify-center p-6 pt-10">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="text-primary-400 h-6 w-6" />
            <h1 className="font-display text-text-primary text-2xl font-bold">Profile</h1>
          </div>
          <p className="text-text-secondary text-sm">Manage your account and view your stats</p>
        </div>

        {/* Stats card */}
        <div className="border-border/50 bg-surface-800 rounded-2xl border p-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary-400/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Trophy className="text-primary-400 h-5 w-5" />
            </div>
            <div>
              <p className="text-text-secondary text-xs font-medium tracking-wide uppercase">
                Personal Best
              </p>
              {bestScore !== null ? (
                <p className="font-display text-text-primary text-2xl font-bold">{bestScore}</p>
              ) : (
                <p className="text-text-secondary text-sm">No games yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Username edit card */}
        <div className="border-border/50 bg-surface-800 space-y-4 rounded-2xl border p-5">
          <div>
            <h2 className="text-text-primary text-sm font-semibold">Username</h2>
            <p className="text-text-secondary text-xs">
              Currently: <span className="text-text-primary font-medium">{username}</span>
            </p>
          </div>
          <UsernameForm currentUsername={username} />
        </div>

        {/* Sign out */}
        <div className="border-border/50 bg-surface-800 rounded-2xl border p-5">
          <p className="text-text-secondary mb-3 text-sm">
            Signed in as <span className="text-text-primary font-medium">{user.email}</span>
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>

        <div className="text-center">
          <Link href="/play/solo" className="text-primary-400 text-sm hover:underline">
            ← Back to game
          </Link>
        </div>
      </div>
    </div>
  );
}
