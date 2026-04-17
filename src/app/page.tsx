// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { ArrowUpDown, Eye, Sparkles } from "lucide-react";
import { LandingHero } from "@/app/_components/LandingHero";
import { getSiteUrl, siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Guess the Video Game by Screenshot & Release Year",
  description:
    "Play Game Guesser, the video game guessing game where you place mystery titles on a release-year timeline in solo mode or with friends.",
};

const howItWorksSteps = [
  {
    icon: Eye,
    title: "See the screenshot",
    description:
      "Study a mystery frame with the title and release year hidden. Use art style, UI, and vibes to narrow it down fast.",
  },
  {
    icon: ArrowUpDown,
    title: "Place it on your timeline",
    description:
      "Drop the card where you think it belongs in release-year order. Every correct placement stretches your streak.",
  },
  {
    icon: Sparkles,
    title: "Reveal the game",
    description:
      "Flip the card to confirm the answer, then chase platform-bonus points and push your run even further.",
  },
] as const;

/** Marketing landing page with auth-aware CTAs and homepage structured data. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = user !== null;
  const primaryCtaLabel = isAuthenticated ? "Continue Playing" : "Play Now";
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
        <LandingHero primaryCtaLabel={primaryCtaLabel} />

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

            <div className="grid gap-4 md:grid-cols-3">
              {howItWorksSteps.map(({ icon: Icon, title, description }, index) => (
                <article
                  key={title}
                  className="bg-surface-800/80 border-border/50 rounded-3xl border p-6 shadow-xl shadow-black/10 backdrop-blur"
                >
                  <div className="bg-primary-500/12 text-primary-300 flex h-12 w-12 items-center justify-center rounded-2xl">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="text-text-disabled mt-5 text-xs font-semibold tracking-[0.2em] uppercase">
                    Step {index + 1}
                  </p>
                  <h3 className="text-text-primary mt-2 text-xl font-semibold">{title}</h3>
                  <p className="text-text-secondary mt-3 text-sm leading-6">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
