// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowUpDown, Eye, Sparkles } from "lucide-react";

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

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.45, ease: "easeOut" as const },
  }),
};

export function HowItWorksCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {howItWorksSteps.map(({ icon: Icon, title, description }, index) => (
        <motion.article
          key={title}
          custom={index}
          variants={cardVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
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
        </motion.article>
      ))}
    </div>
  );
}
