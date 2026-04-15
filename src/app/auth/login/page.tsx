// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="border-border/50 bg-surface-800 w-full max-w-sm space-y-6 rounded-2xl border p-8">
        <div className="space-y-1 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Gamepad2 className="text-primary-400 h-6 w-6" />
            <span className="font-display text-text-primary text-lg font-bold">Game Guesser</span>
          </Link>
          <h1 className="font-display text-text-primary text-2xl font-bold">Welcome back</h1>
          <p className="text-text-secondary text-sm">Sign in to save your scores</p>
        </div>

        <LoginForm next={next} />
      </div>
    </div>
  );
}
