import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-surface-700/50 p-6">
          <Gamepad2 className="h-16 w-16 text-primary-400 opacity-60" />
        </div>

        <h1 className="font-display text-6xl font-bold tracking-tight text-text-primary">404</h1>
        <p className="max-w-sm text-lg text-text-secondary">
          This page wandered off the timeline. Let&apos;s get you back to the game.
        </p>
      </div>

      <Button asChild size="lg" className="rounded-xl px-8 font-bold active:scale-95">
        <Link href="/">Back to Home</Link>
      </Button>
    </main>
  );
}
