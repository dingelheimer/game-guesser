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
 */
export async function ensureMultiplayerSession(): Promise<EnsureMultiplayerSessionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError !== null) {
    return {
      success: false,
      message: "Couldn't verify your session. Please try again.",
    };
  }

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
