// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getSoloDifficultyLabel } from "@/lib/solo/share";
import {
  decodeShareResultPayload,
  formatPlatformBonusSummary,
  formatShareOutcomeGrid,
} from "@/lib/shareResult";
import { getSiteUrl, siteConfig } from "@/lib/site";

type ResultsSearchParams = Promise<{
  d?: string;
}>;

function buildResultsOgImageUrl(encodedPayload: string): string {
  const url = new URL("/api/og", siteConfig.url);
  url.searchParams.set("d", encodedPayload);
  return url.toString();
}

/**
 * Build share-specific metadata for public stateless result URLs.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: ResultsSearchParams;
}): Promise<Metadata> {
  const { d } = await searchParams;
  const result = decodeShareResultPayload(d);

  if (result === null || d === undefined) {
    return {
      title: "Result not found",
      description: "This Game Guesser result link is invalid or has been corrupted.",
    };
  }

  const modeLabel = result.mode === "solo" ? "Solo" : "Multiplayer";
  const ogImageUrl = buildResultsOgImageUrl(d);

  return {
    title: `${modeLabel} result`,
    description: `${getSoloDifficultyLabel(result.difficulty)} ${modeLabel.toLowerCase()} result: ${String(result.score)}/${String(result.turnsPlayed)} from ${String(result.yearRange.start)} to ${String(result.yearRange.end)}.`,
    openGraph: {
      title: `${siteConfig.name} ${modeLabel} Result`,
      description: `Can you beat ${String(result.score)}/${String(result.turnsPlayed)} on ${getSoloDifficultyLabel(result.difficulty)}?`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} shared result`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteConfig.name} ${modeLabel} Result`,
      description: `Can you beat ${String(result.score)}/${String(result.turnsPlayed)} on ${getSoloDifficultyLabel(result.difficulty)}?`,
      images: [ogImageUrl],
    },
  };
}

/**
 * Public stateless results page for shared solo and multiplayer game summaries.
 */
export default async function ResultsPage({ searchParams }: { searchParams: ResultsSearchParams }) {
  const { d } = await searchParams;
  const result = decodeShareResultPayload(d);

  if (result === null) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10 md:px-6">
        <section className="bg-surface-900/95 w-full max-w-2xl rounded-[2rem] border border-white/10 px-6 py-10 text-center shadow-2xl shadow-black/30 backdrop-blur">
          <p className="text-primary-300 text-sm font-semibold tracking-[0.22em] uppercase">
            Shared Result
          </p>
          <h1 className="font-display text-text-primary mt-4 text-4xl font-bold">
            Result not found
          </h1>
          <p className="text-text-secondary mt-4 text-sm leading-6 md:text-base">
            This result link is invalid or corrupted. Start a fresh run and share a new result from
            the game-over screen.
          </p>
          <a
            href={getSiteUrl("/")}
            className="bg-primary-500 hover:bg-primary-400 mt-6 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors"
          >
            Back to home
          </a>
        </section>
      </div>
    );
  }

  const difficultyLabel = getSoloDifficultyLabel(result.difficulty);
  const modeLabel = result.mode === "solo" ? "Solo" : "Multiplayer";
  const shareUrl =
    d === undefined ? getSiteUrl("/results") : getSiteUrl(`/results?d=${encodeURIComponent(d)}`);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8 md:px-6 md:py-12">
      <section className="bg-surface-900/95 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="border-b border-white/10 bg-white/[0.03] px-6 py-6 md:px-8">
          <p className="text-primary-300 text-sm font-semibold tracking-[0.22em] uppercase">
            Shared Result
          </p>
          <h1 className="font-display text-text-primary mt-3 text-4xl font-bold md:text-5xl">
            {siteConfig.name} {modeLabel} Result
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6 md:text-base">
            {difficultyLabel} difficulty, spoiler-free score card, and a quick path back into the
            game.
          </p>
        </div>

        <div className="grid gap-8 px-6 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-6">
            <div className="bg-surface-800/75 rounded-3xl border border-white/10 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-200 uppercase">
                  {modeLabel}
                </span>
                <span className="border-primary-400/30 bg-primary-500/10 text-primary-300 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase">
                  {difficultyLabel}
                </span>
              </div>

              <p className="mt-5 font-mono text-3xl leading-tight md:text-4xl">
                {formatShareOutcomeGrid(result.outcomes)}
              </p>
              {result.mode === "multiplayer" &&
              result.placement !== undefined &&
              result.playerCount !== undefined ? (
                <p className="text-text-secondary mt-3 text-sm leading-6">
                  Finished #{result.placement} out of {result.playerCount} players.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="bg-surface-800/75 rounded-3xl border border-white/10 p-5">
                <p className="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
                  Score
                </p>
                <p className="text-text-primary mt-3 font-mono text-3xl font-bold">
                  {result.score}/{result.turnsPlayed}
                </p>
              </article>
              <article className="bg-surface-800/75 rounded-3xl border border-white/10 p-5">
                <p className="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
                  Year range
                </p>
                <p className="text-text-primary mt-3 font-mono text-2xl font-bold">
                  {result.yearRange.start} → {result.yearRange.end}
                </p>
              </article>
              <article className="bg-surface-800/75 rounded-3xl border border-white/10 p-5">
                <p className="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
                  Platform bonus
                </p>
                <p className="text-text-primary mt-3 text-sm leading-6 font-semibold md:text-base">
                  {formatPlatformBonusSummary(
                    result.platformBonusEarned,
                    result.platformBonusOpportunities,
                  )}
                </p>
              </article>
            </div>
          </div>

          <aside className="bg-surface-800/60 flex flex-col justify-between rounded-3xl border border-white/10 p-6">
            <div>
              <p className="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
                Challenge a friend
              </p>
              <p className="text-text-primary mt-3 text-lg font-semibold">Play Game Guesser</p>
              <p className="text-text-secondary mt-3 text-sm leading-6">
                Start your own run, host a room, and see if you can top this spoiler-free result.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <a
                href={getSiteUrl("/play/solo")}
                className="bg-primary-500 hover:bg-primary-400 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
              >
                Play Solo
              </a>
              <a
                href={getSiteUrl("/play")}
                className="border-border/70 bg-surface-900/70 text-text-primary inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
              >
                Play with Friends
              </a>
              <p className="text-text-secondary text-xs break-all">{shareUrl}</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
