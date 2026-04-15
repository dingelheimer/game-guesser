// SPDX-License-Identifier: AGPL-3.0-only
import { Code } from "lucide-react";
import { GameDataAttribution } from "@/components/layouts/game-data-attribution";
import { SourceCodeLink } from "@/components/layouts/source-code-link";

/** Slim mobile attribution bar that sits above the fixed bottom navigation. */
export function MobileAttributionBar() {
  return (
    <div className="border-border/50 bg-surface-900/95 fixed right-0 bottom-16 left-0 z-30 border-t backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between px-3 py-2">
        <GameDataAttribution className="text-[11px] leading-tight" />
        <SourceCodeLink className="text-[11px] leading-tight">
          <Code className="h-3 w-3" />
          Source
        </SourceCodeLink>
      </div>
    </div>
  );
}
