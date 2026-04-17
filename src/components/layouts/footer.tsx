// SPDX-License-Identifier: AGPL-3.0-only
import Link from "next/link";
import Image from "next/image";
import { Code } from "lucide-react";
import { GameDataAttribution } from "@/components/layouts/game-data-attribution";
import { SourceCodeLink } from "@/components/layouts/source-code-link";
import { PrivacySettingsButton } from "@/components/layouts/privacy-settings-button";
import { siteConfig } from "@/lib/site";

/** Desktop footer with persistent game-data attribution and source code link. */
export function Footer() {
  return (
    <footer className="border-border/50 bg-surface-800/50 hidden border-t py-4 md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <GameDataAttribution />
        <div className="flex items-center gap-4">
          <a
            href={siteConfig.kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-disabled hover:text-text-secondary flex items-center gap-1 text-xs transition-colors"
          >
            <Image src="/kofi.svg" alt="" width={14} height={14} className="opacity-60" aria-hidden />
            Support us on Ko-fi
          </a>
          <Link
            href={siteConfig.privacyUrl}
            className="text-text-disabled hover:text-text-secondary text-xs transition-colors"
          >
            Privacy Policy
          </Link>
          <PrivacySettingsButton className="text-xs" />
          <SourceCodeLink className="text-xs">
            <Code className="h-3.5 w-3.5" />
            View Source
          </SourceCodeLink>
        </div>
      </div>
    </footer>
  );
}
