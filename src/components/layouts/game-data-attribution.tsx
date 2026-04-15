// SPDX-License-Identifier: AGPL-3.0-only
import { cn } from "@/lib/utils";

type GameDataAttributionProps = {
  /** Extra classes for layout-specific sizing and positioning. */
  className?: string;
};

const attributionLinkClassName =
  "text-text-secondary hover:text-primary-400 underline-offset-2 transition-colors hover:underline";

/** Shared IGDB / Twitch attribution copy used by desktop and mobile layouts. */
export function GameDataAttribution({ className }: GameDataAttributionProps) {
  return (
    <div className={cn("text-text-disabled text-xs", className)}>
      Game data provided by{" "}
      <a
        href="https://www.igdb.com"
        target="_blank"
        rel="noopener noreferrer"
        className={attributionLinkClassName}
      >
        IGDB
      </a>{" "}
      /{" "}
      <a
        href="https://www.twitch.tv"
        target="_blank"
        rel="noopener noreferrer"
        className={attributionLinkClassName}
      >
        Twitch
      </a>
    </div>
  );
}
