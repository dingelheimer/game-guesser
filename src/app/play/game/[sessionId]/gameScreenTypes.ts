// SPDX-License-Identifier: AGPL-3.0-only

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import type {
  ExpertVerificationResultPayload,
  PlatformBonusResultPayload,
  TeamGameOverPayload,
} from "@/lib/multiplayer/turns";
import type { ShareOutcome, ShareYearRange } from "@/lib/share";

/** Delay (ms) to preview a failed placement before reconciling the board. */
export const FAILED_PLACEMENT_PREVIEW_MS = 900;

/** Delay (ms) before broadcasting the follow-up turn or game-over event. */
export const TURN_FOLLOW_UP_DELAY_MS = 1500;

/** Interval (ms) for the stale-phase recovery check in auto-progression. */
export const STALE_PHASE_POLL_INTERVAL_MS = 5000;

/** How far past a phaseDeadline (ms) before treating the phase as stale. */
export const STALE_PHASE_THRESHOLD_MS = 5000;

/** Interval (ms) for the periodic DB reconciliation safety-net poll. */
export const RECONCILIATION_POLL_INTERVAL_MS = 15000;

/** How long (ms) a receiving client waits for a follow-up broadcast before fetching from DB. */
export const FOLLOW_UP_RECOVERY_TIMEOUT_MS = TURN_FOLLOW_UP_DELAY_MS + 3500;

/** Seconds to wait for a disconnected active player before auto-skipping. */
export const ACTIVE_PLAYER_DISCONNECT_GRACE_SECONDS = 30;

/** Visual feedback shown briefly after an incorrect placement. */
export type PlacementFeedback = Readonly<{
  gameId: string;
  playerId: string;
  tone: "error";
}> | null;

/** Current platform-bonus result (null when no result yet). */
export type PlatformBonusState = PlatformBonusResultPayload | null;

/** Current expert-verification result (null when no result yet). */
export type ExpertVerificationState = ExpertVerificationResultPayload | null;

/** Tracks the disconnect grace window for the active player. */
export type DisconnectGraceState = Readonly<{
  deadline: string;
  turnKey: string;
}> | null;

/**
 * Props for the realtime multiplayer game screen.
 */
export type GameScreenProps = Readonly<{
  initialGame: MultiplayerGamePageData;
}>;

/** Mutable refs owned by GameScreen and shared with transition callbacks. */
export type TransitionRefs = Readonly<{
  disconnectCountdownIntervalRef: RefObject<number | null>;
  failedPlacementTimeoutRef: RefObject<number | null>;
  playersRef: RefObject<MultiplayerGamePageData["players"]>;
  progressionTimeoutRef: RefObject<number | null>;
}>;

/** State setters consumed by transition callbacks. */
export type TransitionSetters = Readonly<{
  setActionError: Dispatch<SetStateAction<string | null>>;
  setChallengeNotice: Dispatch<SetStateAction<string | null>>;
  setDisconnectCountdown: Dispatch<SetStateAction<number | null>>;
  setDisconnectGrace: Dispatch<SetStateAction<DisconnectGraceState>>;
  setExpertVerificationResult: Dispatch<SetStateAction<ExpertVerificationState>>;
  setGame: Dispatch<SetStateAction<MultiplayerGamePageData>>;
  setIsSkippingTurn: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingChallenge: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingExpertVerification: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingPlacement: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingPlatformBonus: Dispatch<SetStateAction<boolean>>;
  setIsSubmittingTeamVote: Dispatch<SetStateAction<boolean>>;
  setPlacementFeedback: Dispatch<SetStateAction<PlacementFeedback>>;
  setPlatformBonusResult: Dispatch<SetStateAction<PlatformBonusState>>;
  setShareOutcomes: Dispatch<SetStateAction<ShareOutcome[]>>;
  setSharePlatformBonusEarned: Dispatch<SetStateAction<number>>;
  setSharePlatformBonusOpportunities: Dispatch<SetStateAction<number>>;
  setShareYearRange: Dispatch<SetStateAction<ShareYearRange | null>>;
  setTeamGameOver: Dispatch<SetStateAction<TeamGameOverPayload | null>>;
  setWinner: Dispatch<SetStateAction<MultiplayerGamePageData["winner"]>>;
}>;
