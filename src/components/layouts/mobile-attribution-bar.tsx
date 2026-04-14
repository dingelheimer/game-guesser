import { GameDataAttribution } from "@/components/layouts/game-data-attribution";

/** Slim mobile attribution bar that sits above the fixed bottom navigation. */
export function MobileAttributionBar() {
  return (
    <div className="border-border/50 bg-surface-900/95 fixed right-0 bottom-16 left-0 z-30 border-t backdrop-blur-xl md:hidden">
      <GameDataAttribution className="mx-auto max-w-lg px-3 py-2 text-center text-[11px] leading-tight" />
    </div>
  );
}
