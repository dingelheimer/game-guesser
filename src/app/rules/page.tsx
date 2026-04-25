// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { ArrowUpDown, Coins, Eye, Sparkles, Trophy, Users } from "lucide-react";

export const metadata: Metadata = {
  title: {
    absolute: "How to Play | Gamester",
  },
  description:
    "Learn how to play Gamester, master platform bonuses, understand tokens and challenges, and get ready for solo or multiplayer rounds.",
};

const howToPlaySteps = [
  {
    icon: Eye,
    title: "Study the screenshot",
    description:
      "Every round starts with a mystery game card that hides the title and release year. Use the screenshot, art style, and UI clues to identify its era.",
  },
  {
    icon: ArrowUpDown,
    title: "Place it on the timeline",
    description:
      "Drop the card where you think it belongs in release-year order. Correct placements expand your timeline and keep the run alive.",
  },
  {
    icon: Sparkles,
    title: "Reveal and score",
    description:
      "Flip the card to see the answer, then collect points, bonuses, or penalties based on the mode you picked before the game started.",
  },
] as const;

const guideCards = [
  {
    icon: Sparkles,
    title: "Platform Bonus",
    description:
      "Some modes add a platform check after a correct placement. Nail the launch platforms to earn a bonus or avoid losing the card in tougher variants.",
  },
  {
    icon: Trophy,
    title: "Solo Endless",
    description:
      "Solo mode is all about streaks. Keep building your timeline for as long as you can, then submit your best score to the leaderboard.",
  },
  {
    icon: Users,
    title: "Multiplayer",
    description:
      "Create a room, invite 2-8 players, and take turns placing games, challenging questionable calls, or cooperating in TEAMWORK mode.",
  },
  {
    icon: Coins,
    title: "Tokens & Challenges",
    description:
      "Tokens power challenge mechanics in competitive multiplayer. Spend them to contest a placement, steal points, and swing the timeline back in your favor.",
  },
] as const;

const faqItems = [
  {
    question: "How do I play Gamester?",
    answer:
      "Read the mystery screenshot, place the game on your timeline by release year, then reveal the answer and resolve any bonus checks or penalties.",
  },
  {
    question: "How many players can play?",
    answer:
      "You can play solo for endless score chasing or host a multiplayer room for 2-8 players.",
  },
  {
    question: "Is Gamester free?",
    answer:
      "Yes. You can jump into the browser game for free and start a solo run or multiplayer room without installing anything.",
  },
] as const;

function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map(({ question, answer }) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: {
              "@type": "Answer",
              text: answer,
            },
          })),
        }),
      }}
    />
  );
}

/** Static how-to-play guide for first-time players and shared links. */
export default function RulesPage() {
  return (
    <>
      <StructuredData />
      <div className="flex flex-1 flex-col">
        <section className="px-4 py-8 md:px-6 md:py-12">
          <div className="mx-auto max-w-6xl space-y-4">
            <p className="text-primary-300 text-sm font-semibold tracking-[0.22em] uppercase">
              How to Play
            </p>
            <h1 className="font-display text-text-primary text-4xl font-bold tracking-tight md:text-5xl">
              Learn Gamester in a couple of rounds.
            </h1>
            <p className="text-text-secondary max-w-3xl text-base leading-7">
              Place each mystery game card on your release-year timeline, reveal the answer, and
              keep the streak alive. Here is the fast version of the rules before you jump into a
              solo run or a room with friends.
            </p>
          </div>
        </section>

        <section aria-labelledby="rules-steps-heading" className="px-4 pb-8 md:px-6 md:pb-12">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-2">
              <h2
                id="rules-steps-heading"
                className="font-display text-text-primary text-3xl font-bold"
              >
                The core loop
              </h2>
              <p className="text-text-secondary max-w-2xl text-sm leading-6 md:text-base">
                Every match follows the same rhythm: read the clue, trust your timeline instincts,
                and enjoy the reveal.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {howToPlaySteps.map(({ icon: Icon, title, description }, index) => (
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

        <section aria-labelledby="rules-modes-heading" className="px-4 pb-8 md:px-6 md:pb-12">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-2">
              <h2
                id="rules-modes-heading"
                className="font-display text-text-primary text-3xl font-bold"
              >
                Modes, bonuses, and pressure points
              </h2>
              <p className="text-text-secondary max-w-2xl text-sm leading-6 md:text-base">
                After the basics, the game opens up with bonus checks, score chasing, and
                multiplayer mind games.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {guideCards.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="bg-surface-800/75 border-border/50 rounded-3xl border p-6 shadow-lg shadow-black/10"
                >
                  <div className="bg-accent-500/12 text-accent-300 flex h-11 w-11 items-center justify-center rounded-2xl">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-text-primary mt-4 text-xl font-semibold">{title}</h3>
                  <p className="text-text-secondary mt-3 text-sm leading-6">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="rules-faq-heading" className="px-4 pb-8 md:px-6 md:pb-12">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-2">
              <h2
                id="rules-faq-heading"
                className="font-display text-text-primary text-3xl font-bold"
              >
                Quick FAQ
              </h2>
              <p className="text-text-secondary max-w-2xl text-sm leading-6 md:text-base">
                The basics most new players want answered before the first round starts.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {faqItems.map(({ question, answer }) => (
                <article
                  key={question}
                  className="bg-surface-800/60 border-border/50 rounded-3xl border p-6"
                >
                  <h3 className="text-text-primary text-lg font-semibold">{question}</h3>
                  <p className="text-text-secondary mt-3 text-sm leading-6">{answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
