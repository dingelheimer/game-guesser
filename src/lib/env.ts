import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

type ClientEnv = z.infer<typeof clientEnvSchema>;

let _clientEnv: ClientEnv | undefined;

export function getClientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv;

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
