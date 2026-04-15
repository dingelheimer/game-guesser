// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { createClient } from "@/lib/supabase/client";

/** Result returned by {@link ensureMultiplayerSession}. */
export type EnsureMultiplayerSessionResult =
  | Readonly<{
      success: true;
      createdGuestSession: boolean;
    }>
  | Readonly<{
      success: false;
      message: string;
    }>;

/**
 * Ensure the browser has a Supabase user session before calling multiplayer Server Actions.
 *
 * When no session exists at all, `getUser()` returns `AuthSessionMissingError` with a null user.
 * We treat that as "no session" and fall through to `signInAnonymously()`.
 */
export async function ensureMultiplayerSession(): Promise<EnsureMultiplayerSessionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user !== null) {
    return {
      success: true,
      createdGuestSession: false,
    };
  }

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError !== null) {
    return {
      success: false,
      message: "Couldn't start a guest session. Please try again.",
    };
  }

  return {
    success: true,
    createdGuestSession: true,
  };
}
