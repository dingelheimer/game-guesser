"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = {};

export function LoginForm({ next }: { next?: string | undefined }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error !== undefined && (
        <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
          {state.error}
        </p>
      )}

      {next !== undefined && <input type="hidden" name="next" value={next} />}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-text-primary block text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!state.fieldErrors?.email}
          placeholder="you@example.com"
        />
        {state.fieldErrors?.email?.map((err) => (
          <p key={err} className="text-destructive text-xs">
            {err}
          </p>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-text-primary block text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
          placeholder="••••••••"
        />
        {state.fieldErrors?.password?.map((err) => (
          <p key={err} className="text-destructive text-xs">
            {err}
          </p>
        ))}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign In"
        )}
      </Button>

      <p className="text-text-secondary text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-primary-400 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
