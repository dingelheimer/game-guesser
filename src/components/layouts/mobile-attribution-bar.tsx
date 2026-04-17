// SPDX-License-Identifier: AGPL-3.0-only
import Link from "next/link";
import Image from "next/image";
import { Code } from "lucide-react";
import { GameDataAttribution } from "@/components/layouts/game-data-attribution";
import { SourceCodeLink } from "@/components/layouts/source-code-link";
import { PrivacySettingsButton } from "@/components/layouts/privacy-settings-button";
import { siteConfig } from "@/lib/site";

/** Slim mobile attribution bar that sits above the fixed bottom navigation. */
export function MobileAttributionBar() {
  return (
    <div className="border-border/50 bg-surface-900/95 fixed right-0 bottom-16 left-0 z-30 border-t backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between px-3 py-2">
        <GameDataAttribution className="text-[11px] leading-tight" />
        <div className="flex items-center gap-3">
          <a
            href={siteConfig.kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-disabled hover:text-text-secondary flex items-center gap-1 text-[11px] leading-tight transition-colors"
          >
            <Image src="/kofi.svg" alt="" width={12} height={12} className="opacity-60" aria-hidden />
            Ko-fi
          </a>
          <Link
            href={siteConfig.privacyUrl}
            className="text-text-disabled hover:text-text-secondary text-[11px] leading-tight transition-colors"
          >
            Privacy
          </Link>
          <PrivacySettingsButton className="text-[11px] leading-tight" />
          <SourceCodeLink className="text-[11px] leading-tight">
            <Code className="h-3 w-3" />
            Source
          </SourceCodeLink>
        </div>
      </div>
    </div>
  );
}
