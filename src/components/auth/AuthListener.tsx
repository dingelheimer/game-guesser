"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase auth state changes and keeps the Next.js router in sync.
 * Mount once in the root layout. Redirects to "/" on sign-out and refreshes
 * server components on any auth event (sign-in, token refresh, etc.).
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
      } else {
        router.refresh();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
