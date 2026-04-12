import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getClientEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * Supabase client that uses the service role key.
 * Bypasses Row Level Security — only use in server-authoritative game logic.
 */
export function createServiceClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getClientEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createSupabaseClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
