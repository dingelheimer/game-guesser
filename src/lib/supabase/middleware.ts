// SPDX-License-Identifier: AGPL-3.0-only
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClientEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Pass through if Supabase is not configured (e.g. local dev without .env.local)
  if (
    supabaseUrl === undefined ||
    supabaseUrl === "" ||
    supabaseKey === undefined ||
    supabaseKey === ""
  ) {
    return NextResponse.next({ request });
  }

  const env = getClientEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validates and refreshes the session token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /profile — redirect unauthenticated users to login
  if (!user && request.nextUrl.pathname.startsWith("/profile")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
