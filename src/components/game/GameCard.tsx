"use client";

import Image from "next/image";
import { useReducedMotion, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScreenshotViewer } from "@/components/game/ScreenshotViewer";
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
  const reduceMotion = useReducedMotion() ?? false;
  const motionEase = [0.4, 0, 0.2, 1] as const;
  const sizeClasses =
    size === "timeline"
      ? "w-[40vw] shrink-0 md:w-[180px] lg:w-[200px] xl:w-[220px]"
      : "w-[70vw] shrink-0 md:w-[340px] lg:w-[420px] xl:w-[480px]";
  const aspectRatioClass = isRevealed ? "aspect-[3/4]" : "aspect-video";
  const flipTransition = reduceMotion ? { duration: 0 } : { duration: 0.6, ease: motionEase };
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { layout: { duration: 0.35, ease: motionEase } };

  const screenshotSrc =
    screenshotImageId !== null
      ? size === "timeline"
        ? screenshotUrlMobile(screenshotImageId)
        : screenshotUrl(screenshotImageId)
      : null;

  const screenshotSizes =
    size === "timeline"
      ? "(max-width: 768px) 40vw, (max-width: 1024px) 180px, (max-width: 1280px) 200px, 220px"
      : "(max-width: 768px) 70vw, (max-width: 1024px) 340px, (max-width: 1280px) 420px, 480px";

  const coverSizes =
    size === "timeline"
      ? "(max-width: 768px) 40vw, (max-width: 1024px) 180px, (max-width: 1280px) 200px, 220px"
      : "(max-width: 768px) 70vw, (max-width: 1024px) 340px, (max-width: 1280px) 420px, 480px";

  if (isLoading) {
    return (
      <div
        className={cn(sizeClasses, aspectRatioClass, "overflow-hidden rounded-2xl", className)}
        aria-busy="true"
        aria-label="Loading game card"
      >
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  const rotateY = isRevealed ? 180 : 0;

  return (
    <motion.div
      layout={!reduceMotion}
      className={cn(sizeClasses, aspectRatioClass, className)}
      style={{ perspective: "1000px" }}
      transition={layoutTransition}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY }}
        initial={false}
        transition={flipTransition}
        aria-label={isRevealed ? `${title}, ${String(releaseYear)}` : "Mystery game card"}
      >
        {/* ── Front face — Screenshot (hidden state) ─────────────────── */}
        <div
          className={cn(
            "absolute inset-0 overflow-hidden rounded-2xl",
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
              className="object-cover"
              priority={!isRevealed}
            />
          ) : (
            <div className="bg-surface-800 h-full w-full" />
          )}

          {size === "hero" && !isRevealed && screenshotImageId !== null ? (
            <ScreenshotViewer screenshotImageId={screenshotImageId} title={title} />
          ) : null}

          {/* Gradient overlay */}
          <div className="from-surface-900/90 absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t to-transparent" />

          {/* "?" badge */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "font-display text-6xl font-bold text-white/80",
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
            "absolute inset-0 overflow-hidden rounded-2xl",
            "bg-surface-800 border border-white/10",
            isRevealed && "ring-primary-500 shadow-[0_0_20px_rgba(139,92,246,0.5)] ring-2",
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
                sizes={coverSizes}
                className="object-cover"
                priority={isRevealed}
              />
            ) : (
              <div className="bg-surface-700 h-full w-full" />
            )}
          </div>

          {/* Metadata */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
            {/* Release year */}
            <span
              className="text-text-primary font-mono text-3xl leading-none font-bold tabular-nums"
              aria-label={`Release year: ${String(releaseYear)}`}
            >
              {releaseYear}
            </span>

            {/* Title */}
            <span className="text-text-primary line-clamp-2 text-sm leading-tight font-semibold">
              {title}
            </span>

            {/* Platform */}
            <span className="text-text-secondary text-xs">{platform}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
