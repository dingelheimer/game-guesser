// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Gamepad2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTION } from "@/lib/motion";

interface LandingHeroProps {
  primaryCtaLabel: string;
}

/** Animated hero section for the marketing landing page. */
export function LandingHero({ primaryCtaLabel }: LandingHeroProps) {
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

  return (
    <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4 py-10 md:px-6 md:py-14">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.30),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(34,211,238,0.25),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(249,115,22,0.10),_transparent_30%)]" />

      <motion.div
        className="mx-auto max-w-2xl space-y-6 text-center"
        {...containerMotionProps}
      >
        <motion.p
          {...itemMotionProps}
          className="text-primary-300 flex items-center justify-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Video game guessing game
        </motion.p>

        <motion.h1
          {...itemMotionProps}
          className="font-display text-text-primary text-4xl font-bold tracking-tight text-balance md:text-6xl"
        >
          Guess the game. Build your timeline.
        </motion.h1>

        <motion.div {...itemMotionProps} className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            asChild
            className="h-11 rounded-xl px-5 text-base shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.5)]"
          >
            <Link href="/play/solo">
              <Gamepad2 className="h-5 w-5" aria-hidden="true" />
              {primaryCtaLabel}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
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
      </motion.div>
    </section>
  );
}
