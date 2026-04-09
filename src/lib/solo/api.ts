/**
 * Client-side API wrappers for the solo game Edge Functions.
 * Uses the Supabase browser client (anon key) — no auth required for solo mode.
 */

import { createClient } from "@/lib/supabase/client";
import type { DifficultyTier } from "@/types/supabase";

// ── Response types (mirrors Edge Function output shapes) ─────────────────────

export interface RevealedCardData {
  game_id: number;
  name: string;
  release_year: number;
  cover_image_id: string;
  screenshot_image_ids: string[];
  platform_names: string[];
}

export interface HiddenCardData {
  game_id: number;
  screenshot_image_ids: string[];
}

export interface StartGameResponse {
  session_id: string;
  difficulty: DifficultyTier;
  score: number;
  timeline: RevealedCardData[];
  current_card: HiddenCardData;
}

export interface TurnResponse {
  correct: boolean;
  revealed_card: RevealedCardData;
  score: number;
  turns_played: number;
  current_streak: number;
  best_streak: number;
  game_over: boolean;
  next_card?: HiddenCardData;
  valid_positions?: number[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Typed wrapper around the loosely-typed Supabase functions.invoke() result. */
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

export function startGame(difficulty: DifficultyTier): Promise<StartGameResponse> {
  return invokeFunction<StartGameResponse>("solo-start", { difficulty });
}

export function submitTurn(sessionId: string, position: number): Promise<TurnResponse> {
  return invokeFunction<TurnResponse>("solo-turn", {
    session_id: sessionId,
    position,
  });
}

