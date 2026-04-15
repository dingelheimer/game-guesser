// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateUsernameAction, type AuthActionState } from "@/lib/auth/actions";
import { UsernameAvailability } from "@/components/auth/UsernameAvailability";

const initialState: AuthActionState = {};

/** Client Component: username edit form with availability check and pending state. */
export function UsernameForm({ currentUsername }: { currentUsername: string }) {
  const [state, formAction, isPending] = useActionState(updateUsernameAction, initialState);
  const [username, setUsername] = useState(currentUsername);

  return (
    <form action={formAction} className="space-y-3">
      {state.success === true && (
        <p
          className="flex items-center gap-1.5 rounded-lg bg-green-400/10 p-3 text-sm text-green-400"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Username updated successfully.
        </p>
      )}

      {state.error !== undefined && (
        <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
          {state.error}
        </p>
      )}

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
          aria-invalid={state.fieldErrors?.username !== undefined}
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

      <Button type="submit" size="sm" disabled={isPending || username === currentUsername}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save Username"
        )}
      </Button>
    </form>
  );
}
