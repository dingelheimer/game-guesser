// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { igdbImageUrl } from "@/lib/igdb/images";
import { cn } from "@/lib/utils";

function stopClickPropagation(event: MouseEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

/**
 * Opens the unrevealed hero-card screenshot in a full-resolution dialog.
 * The entire card face is the click target — tap or click anywhere to zoom.
 */
export function ScreenshotViewer({
  screenshotImageId,
  title,
}: {
  screenshotImageId: string;
  title: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const screenshotLabel = title === "?" ? "Game screenshot" : `${title} screenshot`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* Transparent full-coverage button — pointer events bubble to dnd-kit
            for drag (distance ≥ 8px); taps/clicks open the lightbox dialog. */}
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
          aria-label="View full-size screenshot"
          onClick={stopClickPropagation}
        />
      </DialogTrigger>

      <DialogContent
        className={cn(
          "w-full max-w-[calc(100vw-1rem)] overflow-hidden border border-white/10 bg-black p-2 sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl",
          reduceMotion &&
            "data-open:zoom-in-100 data-closed:zoom-out-100 duration-0 data-closed:animate-none data-open:animate-none",
        )}
        overlayClassName={cn(
          "bg-black/80",
          reduceMotion && "data-open:animate-none data-closed:animate-none duration-0",
        )}
      >
        <DialogTitle className="sr-only">{`${screenshotLabel} viewer`}</DialogTitle>
        <DialogDescription className="sr-only">
          {`Full-resolution ${screenshotLabel.toLowerCase()} for inspecting visual details before placing the card.`}
        </DialogDescription>

        <div className="overflow-hidden rounded-lg">
          <Image
            src={igdbImageUrl(screenshotImageId, "screenshot_huge")}
            alt={screenshotLabel}
            width={1280}
            height={720}
            sizes="(max-width: 768px) calc(100vw - 1.5rem), (max-width: 1440px) 90vw, 1280px"
            className="h-auto w-full object-contain"
            priority
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
