// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { LandingHero } from "@/app/_components/LandingHero";
import { HowItWorksCards } from "@/app/_components/HowItWorksCards";
import { getSiteUrl, siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { fetchDailyChallengeStatus } from "@/lib/daily/status.server";

export const metadata: Metadata = {
  title: "Guess the Video Game by Screenshot & Release Year",
  description:
    "Play Gamester, the video game guessing game where you place mystery titles on a release-year timeline in solo mode or with friends.",
};

/** Marketing landing page with auth-aware CTAs and homepage structured data. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const dailyChallengeStatus = await fetchDailyChallengeStatus(user?.id ?? null);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["WebApplication", "Game"],
    name: siteConfig.name,
    description: siteConfig.description,
    url: getSiteUrl(),
    applicationCategory: "Game",
    operatingSystem: "Any",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="flex flex-1 flex-col">
        <LandingHero dailyChallengeStatus={dailyChallengeStatus} />

        <section aria-labelledby="how-it-works-label" className="px-4 py-8 md:px-6 md:py-12">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="text-center md:text-left">
              <p
                id="how-it-works-label"
                className="text-primary-300 text-sm font-semibold tracking-[0.22em] uppercase"
              >
                How It Works
              </p>
            </div>

            <HowItWorksCards />
          </div>
        </section>
      </div>
    </>
  );
}
