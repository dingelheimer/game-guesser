"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase auth state changes and keeps the Next.js router in sync.
 * Mount once in the root layout. Redirects to "/" on sign-out and refreshes
 * server components only on sign-in and token-refresh events to avoid an
 * infinite refresh loop triggered by INITIAL_SESSION on every page load.
 */
export function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        router.refresh();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
