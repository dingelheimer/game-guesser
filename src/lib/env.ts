// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

type ClientEnv = z.infer<typeof clientEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;

let _clientEnv: ClientEnv | undefined;
let _serverEnv: ServerEnv | undefined;

export function getClientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv;

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  });

  if (!parsed.success) {
    console.error(
      "❌ Missing or invalid Supabase environment variables:",
      z.treeifyError(parsed.error),
    );
    throw new Error("Missing Supabase environment variables. See .env.local.example");
  }

  _clientEnv = parsed.data;
  return _clientEnv;
}

export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  });

  if (!parsed.success) {
    console.error(
      "❌ Missing or invalid server-only environment variables:",
      z.treeifyError(parsed.error),
    );
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. See .env.local.example");
  }

  _serverEnv = parsed.data;
  return _serverEnv;
}
