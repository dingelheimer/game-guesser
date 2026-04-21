// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Client-side API wrappers for the daily challenge Edge Functions.
 * Uses the Supabase browser client (anon key) — auth token is sent automatically
 * when the user is authenticated, otherwise anonymous_id is used for identity.
 */

import { createClient } from "@/lib/supabase/client";
import type { HiddenCardData, RevealedCardData } from "@/lib/solo/api";

export type { HiddenCardData, RevealedCardData } from "@/lib/solo/api";

// ── Response types (mirrors Edge Function output shapes) ─────────────────────

export interface DailyTimelineEntry {
  game_id: number;
  release_year: number;
}

export interface DailyPlacementRecord {
  game_id: number;
  position: number;
  correct: boolean;
  extra_try?: boolean;
  valid_positions?: number[];
}

interface DailyStartBase {
  result_id: number;
  challenge_number: number;
  challenge_date: string;
  total_cards: number;
  score: number;
  turns_played: number;
  extra_try_used: boolean;
  placements: DailyPlacementRecord[];
  timeline: DailyTimelineEntry[];
}

export interface DailyStartResponseStarted extends DailyStartBase {
  status: "started";
  anchor_card: RevealedCardData;
  current_card: HiddenCardData;
  extra_try_available: true;
}

export interface DailyStartResponseInProgress extends DailyStartBase {
  status: "in_progress";
  anchor_card: RevealedCardData;
  current_card: HiddenCardData;
  extra_try_available: boolean;
}

export interface DailyStartResponseCompleted extends DailyStartBase {
  status: "completed";
}

export type DailyStartResponse =
  | DailyStartResponseStarted
  | DailyStartResponseInProgress
  | DailyStartResponseCompleted;

export interface DailyTurnResponse {
  correct: boolean;
  revealed_card: RevealedCardData;
  score: number;
  turns_played: number;
  extra_try_available: boolean;
  game_over: boolean;
  next_card?: HiddenCardData;
  valid_positions?: number[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface InvokeResult<T> {
  data: T | null;
  error: null | { message: string };
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  const result = (await supabase.functions.invoke(name, { body })) as InvokeResult<T>;
  if (result.error !== null) throw new Error(`${name} failed: ${result.error.message}`);
  if (result.data === null) throw new Error(`${name} returned no data`);
  return result.data;
}

// ── API functions ─────────────────────────────────────────────────────────────

export function startDaily(anonymousId?: string): Promise<DailyStartResponse> {
  const body: Record<string, unknown> = {};
  if (anonymousId !== undefined) body["anonymous_id"] = anonymousId;
  return invokeFunction<DailyStartResponse>("daily-start", body);
}

export function submitDailyTurn(
  resultId: number,
  position: number,
  anonymousId?: string,
): Promise<DailyTurnResponse> {
  const body: Record<string, unknown> = { result_id: resultId, position };
  if (anonymousId !== undefined) body["anonymous_id"] = anonymousId;
  return invokeFunction<DailyTurnResponse>("daily-turn", body);
}
