// SPDX-License-Identifier: AGPL-3.0-only
import { scanAndAdvanceExpiredSessions } from "@/lib/multiplayer/phaseExpiryService";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Vercel Cron handler — scans for expired multiplayer game phases and advances them.
 *
 * Schedule: every minute (see vercel.json).
 *
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` with every invocation.
 * The CRON_SECRET environment variable must be set in the Vercel project settings.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env["CRON_SECRET"];

  if (cronSecret === undefined || cronSecret === "") {
    console.error("[phase-expiry] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await scanAndAdvanceExpiredSessions();
  console.log(
    `[phase-expiry] Scan complete: processed=${String(result.processed)} advanced=${String(result.advanced)} errors=${String(result.errors)}`,
  );

  return NextResponse.json(result);
}
