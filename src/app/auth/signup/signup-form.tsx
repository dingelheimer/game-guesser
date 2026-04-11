"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signUpAction, type AuthActionState } from "@/lib/auth/actions";
import { UsernameAvailability } from "./username-availability";

const initialState: AuthActionState = {};

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const [username, setUsername] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {state.error !== undefined && (
        <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
          {state.error}
        </p>
      )}

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
        <label htmlFor="username" className="text-text-primary block text-sm font-medium">
          Username
        </label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          aria-invalid={!!state.fieldErrors?.username}
          placeholder="cool_gamer_42"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
          }}
        />
        <UsernameAvailability username={username} />
        {state.fieldErrors?.username?.map((err) => (
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
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
          placeholder="••••••••"
        />
        <p className="text-text-secondary text-xs">Minimum 8 characters</p>
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
            Creating account…
          </>
        ) : (
          "Create Account"
        )}
      </Button>

      <p className="text-text-secondary text-center text-sm">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-primary-400 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
