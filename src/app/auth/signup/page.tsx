import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create Account",
};

export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="border-border/50 bg-surface-800 w-full max-w-sm space-y-6 rounded-2xl border p-8">
        <div className="space-y-1 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Gamepad2 className="text-primary-400 h-6 w-6" />
            <span className="font-display text-text-primary text-lg font-bold">Game Guesser</span>
          </Link>
          <h1 className="font-display text-text-primary text-2xl font-bold">Create account</h1>
          <p className="text-text-secondary text-sm">Join to save your scores and compete</p>
        </div>

        <SignUpForm />
      </div>
    </div>
  );
}
