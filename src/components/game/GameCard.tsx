"use client";

import Image from "next/image";
import { useReducedMotion, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { coverUrl, screenshotUrl, screenshotUrlMobile } from "@/lib/igdb/images";

export interface GameCardProps {
  /** IGDB image ID for the screenshot shown during guessing. */
  screenshotImageId: string | null;
  /** IGDB image ID for the cover art revealed after placement. */
  coverImageId: string | null;
  /** Game title shown on the revealed face. */
  title: string;
  /** Release year shown prominently on the revealed face. */
  releaseYear: number;
  /** Platform name shown on the revealed face. */
  platform: string;
  /** Whether the card has been flipped to the revealed state. */
  isRevealed: boolean;
  /** Show skeleton placeholder while images are loading. */
  isLoading?: boolean;
  /**
   * Card size variant.
   * - `"hero"` (default): current-card area; uses full-size screenshots.
   * - `"timeline"`: compact placed card; uses mobile-optimised screenshots.
   */
  size?: "hero" | "timeline";
  className?: string;
}

/**
 * Hero game card component.
 *
 * Hidden face: screenshot + "?" overlay + gradient.
 * Revealed face: cover art + title + year + platform.
 * Flips with a 3-D rotateY animation (disabled for prefers-reduced-motion).
 */
export function GameCard({
  screenshotImageId,
  coverImageId,
  title,
  releaseYear,
  platform,
  isRevealed,
  isLoading = false,
  size = "hero",
  className,
}: GameCardProps) {
  const reduceMotion = useReducedMotion();

  const screenshotSrc =
    screenshotImageId !== null
      ? size === "timeline"
        ? screenshotUrlMobile(screenshotImageId)
        : screenshotUrl(screenshotImageId)
      : null;

  const screenshotSizes =
    size === "timeline"
      ? "(max-width: 768px) 40vw, 200px"
      : "(max-width: 768px) 80vw, 480px";

  if (isLoading) {
    return (
      <div
        className={cn(
          "w-[70vw] md:w-[200px]",
          "aspect-[3/4] rounded-2xl overflow-hidden",
          className,
        )}
        aria-busy="true"
        aria-label="Loading game card"
      >
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  const rotateY = isRevealed ? 180 : 0;

  return (
    <div
      className={cn("w-[70vw] md:w-[200px] aspect-[3/4]", className)}
      style={{ perspective: "1000px" }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY }}
        initial={false}
        transition={
          reduceMotion === true
            ? { duration: 0 }
            : { duration: 0.6, ease: [0.4, 0, 0.2, 1] }
        }
        aria-label={isRevealed ? `${title}, ${String(releaseYear)}` : "Mystery game card"}
      >
        {/* ── Front face — Screenshot (hidden state) ─────────────────── */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl overflow-hidden",
            "bg-surface-900 border border-white/10",
          )}
          style={{ backfaceVisibility: "hidden" }}
          aria-hidden={isRevealed}
        >
          {screenshotSrc !== null ? (
            <Image
              src={screenshotSrc}
              alt="Game screenshot"
              fill
              sizes={screenshotSizes}
              className="object-contain"
              priority={!isRevealed}
            />
          ) : (
            <div className="h-full w-full bg-surface-800" />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-surface-900/90 to-transparent" />

          {/* "?" badge */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "text-6xl font-bold text-white/80 font-display",
                "drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]",
              )}
              aria-hidden="true"
            >
              ?
            </span>
          </div>
        </div>

        {/* ── Back face — Revealed state ─────────────────────────────── */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl overflow-hidden",
            "bg-surface-800 border border-white/10",
            isRevealed &&
              "ring-2 ring-primary-500 shadow-[0_0_20px_rgba(139,92,246,0.5)]",
          )}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
          aria-hidden={!isRevealed}
        >
          {/* Cover art */}
          <div className="relative h-3/5 w-full">
            {coverImageId !== null ? (
              <Image
                src={coverUrl(coverImageId)}
                alt={`${title} cover art`}
                fill
                sizes="(max-width: 768px) 70vw, 200px"
                className="object-cover"
                priority={isRevealed}
              />
            ) : (
              <div className="h-full w-full bg-surface-700" />
            )}
          </div>

          {/* Metadata */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
            {/* Release year */}
            <span
              className="font-mono tabular-nums text-3xl font-bold leading-none text-text-primary"
              aria-label={`Release year: ${String(releaseYear)}`}
            >
              {releaseYear}
            </span>

            {/* Title */}
            <span className="line-clamp-2 text-sm font-semibold leading-tight text-text-primary">
              {title}
            </span>

            {/* Platform */}
            <span className="text-xs text-text-secondary">{platform}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
