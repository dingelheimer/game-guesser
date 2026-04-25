// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site";
import { DailyGamePage } from "./DailyGamePage";

const DAILY_URL = `${siteConfig.url}/daily`;
const DESCRIPTION =
  "Can you place all 10 games on the timeline? Play today's challenge and compare your score!";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: challenge } = await supabase
    .from("daily_challenges")
    .select("challenge_number")
    .eq("challenge_date", today)
    .maybeSingle();

  const title =
    challenge !== null
      ? `Gamester — Daily Challenge #${String(challenge.challenge_number)}`
      : "Gamester — Daily Challenge";

  return {
    title: { absolute: title },
    description: DESCRIPTION,
    alternates: { canonical: DAILY_URL },
    openGraph: {
      title,
      description: DESCRIPTION,
      url: DAILY_URL,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DESCRIPTION,
    },
  };
}

export default function DailyPage() {
  return <DailyGamePage />;
}
