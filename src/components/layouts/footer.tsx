// SPDX-License-Identifier: AGPL-3.0-only
import { Code } from "lucide-react";
import { GameDataAttribution } from "@/components/layouts/game-data-attribution";
import { SourceCodeLink } from "@/components/layouts/source-code-link";
import { PrivacySettingsButton } from "@/components/layouts/privacy-settings-button";

/** Desktop footer with persistent game-data attribution and source code link. */
export function Footer() {
  return (
    <footer className="border-border/50 bg-surface-800/50 hidden border-t py-4 md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <GameDataAttribution />
        <div className="flex items-center gap-4">
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
