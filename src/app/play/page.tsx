// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PlayHub } from "./PlayHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Play",
  description: "Choose solo play or create and join a multiplayer lobby.",
};

/**
 * Play hub page with solo and multiplayer entry points.
 */
export default async function PlayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user !== null) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    username = profile?.username ?? null;
  }

  return <PlayHub defaultDisplayName={username} />;
}
