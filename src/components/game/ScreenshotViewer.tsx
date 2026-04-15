// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import type { SyntheticEvent } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { igdbImageUrl } from "@/lib/igdb/images";
import { cn } from "@/lib/utils";

function stopTriggerEvent(event: SyntheticEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

/**
 * Opens the unrevealed hero-card screenshot in a full-resolution dialog.
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
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="absolute top-3 right-3 z-10 bg-black/70 text-white shadow-md backdrop-blur-sm hover:bg-black/80"
          aria-label="View full-size screenshot"
          onClick={stopTriggerEvent}
          onMouseDown={stopTriggerEvent}
          onPointerDown={stopTriggerEvent}
          onTouchStart={stopTriggerEvent}
        >
          <SearchIcon />
        </Button>
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
