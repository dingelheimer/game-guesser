// SPDX-License-Identifier: AGPL-3.0-only
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-surface-700/50 rounded-2xl p-6">
          <Gamepad2 className="text-primary-400 h-16 w-16 opacity-60" />
        </div>

        <h1 className="font-display text-text-primary text-6xl font-bold tracking-tight">404</h1>
        <p className="text-text-secondary max-w-sm text-lg">
          This page wandered off the timeline. Let&apos;s get you back to the game.
        </p>
      </div>

      <Button asChild size="lg" className="rounded-xl px-8 font-bold active:scale-95">
        <Link href="/">Back to Home</Link>
      </Button>
    </main>
  );
}
