// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, Gamepad2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTION } from "@/lib/motion";
import type { DailyChallengeStatus } from "@/lib/daily/status.server";

// ── Motion helpers ────────────────────────────────────────────────────────────

function useHeroMotion(reduceMotion: boolean) {
  const containerProps = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "visible" as const,
        variants: {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.05 },
          },
        },
      };
  const itemProps = reduceMotion
    ? {}
    : {
        variants: {
          hidden: { opacity: 0, y: 18 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: MOTION.duration.normal, ease: MOTION.ease.out },
          },
        },
      };
  return { containerProps, itemProps };
}

// ── CTA helpers ───────────────────────────────────────────────────────────────

const BIG_BUTTON_CLASS =
  "group hover:from-primary-400 hover:to-primary-500 motion-safe:animate-pulse-glow h-16 w-full rounded-2xl px-12 text-xl font-bold tracking-wide shadow-[0_0_30px_rgba(139,92,246,0.5),0_0_60px_rgba(139,92,246,0.25)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(139,92,246,0.7),0_0_80px_rgba(139,92,246,0.35)] active:scale-[0.98] sm:w-auto md:h-20 md:text-2xl";

interface CtaProps {
  itemProps: Record<string, unknown>;
}

function GuestDailyCta({ itemProps, challengeNumber }: CtaProps & { challengeNumber?: number }) {
  const label =
    challengeNumber !== undefined
      ? `Daily Challenge #${String(challengeNumber)}`
      : "Daily Challenge";
  return (
    <motion.div {...itemProps} className="flex flex-col items-center gap-3">
      <Button size="lg" asChild className={BIG_BUTTON_CLASS}>
        <Link href="/daily">
          <CalendarDays className="h-7 w-7" aria-hidden="true" />
          {label} — Play Now
          <ArrowRight
            className="h-7 w-7 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </Button>
      <Button
        size="sm"
        asChild
        variant="ghost"
        className="text-text-secondary hover:text-text-primary text-sm"
      >
        <Link href="/play">
          <Users className="h-4 w-4" aria-hidden="true" />
          Play with Friends
        </Link>
      </Button>
    </motion.div>
  );
}

function NotPlayedDailyCta({
  itemProps,
  challengeNumber,
  inProgress,
}: CtaProps & { challengeNumber: number; inProgress: boolean }) {
  const label = inProgress
    ? `Daily Challenge #${String(challengeNumber)} — Continue`
    : `Daily Challenge #${String(challengeNumber)} — Play Now`;
  return (
    <motion.div {...itemProps} className="flex flex-col items-center gap-3">
      <Button size="lg" asChild className={BIG_BUTTON_CLASS}>
        <Link href="/daily">
          <CalendarDays className="h-7 w-7" aria-hidden="true" />
          {label}
          <ArrowRight
            className="h-7 w-7 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </Button>
      <Button
        size="sm"
        asChild
        variant="ghost"
        className="text-text-secondary hover:text-text-primary text-sm"
      >
        <Link href="/play">
          <Users className="h-4 w-4" aria-hidden="true" />
          Play with Friends
        </Link>
      </Button>
    </motion.div>
  );
}

function CompletedDailyCta({
  itemProps,
  challengeNumber,
  score,
  totalCards,
  currentStreak,
}: CtaProps & {
  challengeNumber: number;
  score: number;
  totalCards: number;
  currentStreak: number | null;
}) {
  const streakText =
    currentStreak !== null && currentStreak > 0 ? ` 🔥${String(currentStreak)}` : "";
  return (
    <motion.div {...itemProps} className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        Daily #{String(challengeNumber)} — {String(score)}/{String(totalCards)}
        {streakText}
        <Link href="/daily" className="underline underline-offset-2 hover:no-underline">
          View Result
        </Link>
      </div>
      <Button size="lg" asChild className={BIG_BUTTON_CLASS}>
        <Link href="/play/solo">
          <Gamepad2 className="h-7 w-7" aria-hidden="true" />
          Play Solo Endless
          <ArrowRight
            className="h-7 w-7 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </Button>
      <Button
        size="sm"
        asChild
        variant="ghost"
        className="text-text-secondary hover:text-text-primary text-sm"
      >
        <Link href="/play">
          <Users className="h-4 w-4" aria-hidden="true" />
          Play with Friends
        </Link>
      </Button>
    </motion.div>
  );
}

function SoloDailyCta({ itemProps, label }: CtaProps & { label: string }) {
  return (
    <motion.div {...itemProps} className="flex flex-col items-center gap-3">
      <Button size="lg" asChild className={BIG_BUTTON_CLASS}>
        <Link href="/play/solo">
          <Gamepad2 className="h-7 w-7" aria-hidden="true" />
          {label}
          <ArrowRight
            className="h-7 w-7 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </Button>
      <Button
        size="sm"
        asChild
        variant="ghost"
        className="text-text-secondary hover:text-text-primary text-sm"
      >
        <Link href="/play">
          <Users className="h-4 w-4" aria-hidden="true" />
          Play with Friends
        </Link>
      </Button>
    </motion.div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LandingHeroProps {
  dailyChallengeStatus: DailyChallengeStatus;
}

/** Animated hero section for the marketing landing page. */
export function LandingHero({ dailyChallengeStatus }: LandingHeroProps) {
  const reduceMotion = useReducedMotion() === true;
  const { containerProps, itemProps } = useHeroMotion(reduceMotion);

  const renderCta = () => {
    switch (dailyChallengeStatus.state) {
      case "no_challenge":
        return <SoloDailyCta itemProps={itemProps} label="Play Now" />;
      case "guest_cta":
        return (
          <GuestDailyCta
            itemProps={itemProps}
            challengeNumber={dailyChallengeStatus.challengeNumber}
          />
        );
      case "not_played":
        return (
          <NotPlayedDailyCta
            itemProps={itemProps}
            challengeNumber={dailyChallengeStatus.challengeNumber}
            inProgress={false}
          />
        );
      case "in_progress":
        return (
          <NotPlayedDailyCta
            itemProps={itemProps}
            challengeNumber={dailyChallengeStatus.challengeNumber}
            inProgress={true}
          />
        );
      case "completed":
        return (
          <CompletedDailyCta
            itemProps={itemProps}
            challengeNumber={dailyChallengeStatus.challengeNumber}
            score={dailyChallengeStatus.score}
            totalCards={dailyChallengeStatus.totalCards}
            currentStreak={dailyChallengeStatus.currentStreak}
          />
        );
    }
  };

  return (
    <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4 py-10 md:px-6 md:py-14">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.30),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(34,211,238,0.25),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(249,115,22,0.10),_transparent_30%)]" />

      <motion.div className="mx-auto max-w-2xl space-y-6 text-center" {...containerProps}>
        <motion.h1
          {...itemProps}
          className="font-display text-text-primary text-4xl font-bold tracking-tight text-balance md:text-6xl"
        >
          Guess the game. Build your timeline.
        </motion.h1>

        {renderCta()}
      </motion.div>
    </section>
  );
}
