// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Gamepad2, LogIn, Sparkles, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTION } from "@/lib/motion";

interface LandingHeroProps {
  isAuthenticated: boolean;
  primaryCtaLabel: string;
}

const previewYears = ["1994", "2001", "2017"] as const;
const statChips = ["Solo Endless", "2-8 players", "Platform Bonus"] as const;

/** Animated hero section for the marketing landing page. */
export function LandingHero({ isAuthenticated, primaryCtaLabel }: LandingHeroProps) {
  const reduceMotion = useReducedMotion();
  const prefersReducedMotion = reduceMotion === true;
  const containerMotionProps = prefersReducedMotion
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
  const itemMotionProps = prefersReducedMotion
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
  const visualMotionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.96, y: 16 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: MOTION.duration.normal, ease: MOTION.ease.out, delay: 0.15 },
      };

  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-8 md:px-6 md:pt-14 md:pb-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.24),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.18),_transparent_28%)]" />

      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-center">
        <motion.div className="space-y-5" {...containerMotionProps}>
          <motion.p
            {...itemMotionProps}
            className="text-primary-300 flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Video game guessing game
          </motion.p>

          <motion.div className="space-y-4" {...itemMotionProps}>
            <h1 className="font-display text-text-primary max-w-xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
              Guess the video game by screenshot and release year.
            </h1>
            <p className="text-text-secondary max-w-2xl text-base leading-7 md:text-lg">
              Place mystery games on a timeline, reveal the answer, and keep the streak alive in
              fast solo runs or friendly multiplayer battles.
            </p>
          </motion.div>

          <motion.div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" {...itemMotionProps}>
            <Button
              size="lg"
              asChild
              className="h-11 rounded-xl px-5 text-base shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.5)]"
            >
              <Link href="/play/solo">
                <Gamepad2 className="h-5 w-5" />
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button size="lg" asChild variant="outline" className="h-11 rounded-xl px-5 text-base">
              <Link href="/play">
                <Users className="h-5 w-5" />
                Play with Friends
              </Link>
            </Button>

            <Button size="lg" asChild variant="ghost" className="h-11 rounded-xl px-5 text-base">
              <Link href="/leaderboard">
                <Trophy className="h-5 w-5" />
                Leaderboard
              </Link>
            </Button>
          </motion.div>

          <motion.div className="flex flex-wrap gap-2" {...itemMotionProps}>
            {statChips.map((chip) => (
              <span
                key={chip}
                className="bg-surface-800/80 text-text-secondary rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium"
              >
                {chip}
              </span>
            ))}
          </motion.div>

          {!isAuthenticated && (
            <motion.p
              className="text-text-disabled flex flex-wrap items-center gap-1.5 text-sm"
              {...itemMotionProps}
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <Link
                href="/auth/login"
                className="text-primary-300 hover:text-primary-200 hover:underline"
              >
                Log in
              </Link>
              to save your best streaks to the leaderboard.
            </motion.p>
          )}
        </motion.div>

        <motion.div className="relative" {...visualMotionProps}>
          <div className="bg-surface-800/75 relative overflow-hidden rounded-[2rem] border border-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="bg-primary-500/20 absolute inset-x-10 top-0 h-32 rounded-full blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-text-disabled text-xs font-semibold tracking-[0.2em] uppercase">
                    Live Preview
                  </p>
                  <p className="text-text-primary mt-1 text-lg font-semibold">
                    Build your timeline
                  </p>
                </div>
                <div className="bg-primary-500/12 text-primary-300 border-primary-400/20 rounded-full border px-3 py-1 text-xs font-semibold">
                  No signup for solo
                </div>
              </div>

              <div className="bg-surface-900/80 rounded-[1.75rem] border border-white/8 p-4">
                <div className="flex min-h-44 items-end rounded-[1.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(139,92,246,0.14),rgba(10,10,15,0.95))] p-4">
                  <div className="w-full space-y-4">
                    <div className="bg-surface-900/70 h-24 rounded-2xl border border-white/10" />
                    <div className="flex items-center justify-between gap-2">
                      {previewYears.map((year) => (
                        <div key={year} className="flex flex-col items-center gap-2">
                          <div className="h-7 w-px bg-white/20" />
                          <span className="bg-surface-800 text-text-secondary rounded-full px-3 py-1 font-mono text-xs tabular-nums">
                            {year}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="bg-surface-900/75 rounded-2xl border border-white/8 p-4">
                  <p className="text-text-disabled text-[11px] font-semibold tracking-[0.2em] uppercase">
                    Step 1
                  </p>
                  <p className="text-text-primary mt-2 text-sm font-semibold">
                    Read the screenshot
                  </p>
                </div>
                <div className="bg-surface-900/75 rounded-2xl border border-white/8 p-4">
                  <p className="text-text-disabled text-[11px] font-semibold tracking-[0.2em] uppercase">
                    Step 2
                  </p>
                  <p className="text-text-primary mt-2 text-sm font-semibold">Drop it in order</p>
                </div>
                <div className="bg-surface-900/75 rounded-2xl border border-white/8 p-4">
                  <p className="text-text-disabled text-[11px] font-semibold tracking-[0.2em] uppercase">
                    Step 3
                  </p>
                  <p className="text-text-primary mt-2 text-sm font-semibold">Reveal and score</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
