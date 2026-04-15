// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";

export function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const keySet = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());

  return NextResponse.json({
    status: "ok",
    supabase: {
      url: url ?? "NOT SET",
      publishableKeySet: keySet,
    },
  });
}
