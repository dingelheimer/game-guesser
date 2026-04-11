import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SoloGamePage } from "./SoloGamePage";

export const metadata: Metadata = {
  title: "Solo Mode",
  description: "Place games in chronological order — how far can you go?",
};

export default async function PlaySoloPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;

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

  return <SoloGamePage username={username} hasPendingScore={saved === "pending"} />;
}
