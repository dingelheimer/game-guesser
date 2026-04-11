import Link from "next/link";
import { Gamepad2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/** Home / landing page with Solo Endless play CTA. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = user !== null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Gamepad2 className="text-primary-400 h-16 w-16" />
        <h1 className="font-display text-text-primary text-5xl font-bold tracking-tight">
          Game Guesser
        </h1>
        <p className="text-text-secondary max-w-sm text-lg">
          Guess when classic games were released. Build your timeline. Beat your streak.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" asChild className="min-w-[200px] gap-2 text-base">
          <Link href="/play/solo">
            <Gamepad2 className="h-5 w-5" />
            Solo Endless
          </Link>
        </Button>

        {!isAuthenticated && (
          <p className="text-text-disabled flex items-center gap-1.5 text-sm">
            <LogIn className="h-3.5 w-3.5" />
            <Link href="/auth/login" className="text-primary-400 hover:underline">
              Log in
            </Link>{" "}
            to save your scores to the leaderboard
          </p>
        )}
      </div>
    </div>
  );
}
