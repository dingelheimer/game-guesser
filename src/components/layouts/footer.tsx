// SPDX-License-Identifier: AGPL-3.0-only
import { GameDataAttribution } from "@/components/layouts/game-data-attribution";

/** Desktop footer with persistent game-data attribution. */
export function Footer() {
  return (
    <footer className="border-border/50 bg-surface-800/50 hidden border-t py-4 md:block">
      <GameDataAttribution className="mx-auto max-w-7xl px-6 text-center" />
    </footer>
  );
}
