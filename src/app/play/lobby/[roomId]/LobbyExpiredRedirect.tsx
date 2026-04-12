"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Renders nothing but redirects to /play on mount.
 *
 * Used in place of a server-side redirect() when the lobby room is no longer
 * in "lobby" status. A client-side redirect avoids throwing NEXT_REDIRECT
 * during a Server Action re-render, which would corrupt the action response.
 */
export function LobbyExpiredRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/play");
  }, [router]);

  return null;
}
