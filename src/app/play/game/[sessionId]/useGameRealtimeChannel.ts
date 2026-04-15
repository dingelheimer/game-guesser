// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState, type RefObject } from "react";
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from "@supabase/realtime-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LobbyPresence } from "@/lib/multiplayer/lobby";
import { LobbyPresenceSchema } from "@/lib/multiplayer/lobby";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import { buildConnectedPresence, buildSeedPresence } from "@/lib/multiplayer/presence";
import {
  buildHiddenTurnCard,
  buildTimelineCardFromEntry,
  ChallengeMadePayloadSchema,
  ExpertVerificationResultPayloadSchema,
  GameOverPayloadSchema,
  GameStartedPayloadSchema,
  PlacementMadePayloadSchema,
  PlatformBonusResultPayloadSchema,
  TeamGameOverPayloadSchema,
  TeamVoteResolvedPayloadSchema,
  TeamVoteUpdatedPayloadSchema,
  TurnRevealedPayloadSchema,
  TurnSkippedPayloadSchema,
  TurnStartedPayloadSchema,
} from "./gameScreenState";
import type { useGameBonusTransitions } from "./useGameBonusTransitions";
import type { useGameStateTransitions } from "./useGameStateTransitions";

/** Combined transition callbacks from core and bonus hooks. */
type Transitions = ReturnType<typeof useGameStateTransitions> &
  ReturnType<typeof useGameBonusTransitions>;

/** Params for the realtime channel hook. */
type UseGameRealtimeChannelParams = Readonly<{
  channelRef: RefObject<RealtimeChannel | null>;
  clearDisconnectGrace: () => void;
  clearFailedPlacementTimeout: () => void;
  clearProgressionTimeout: () => void;
  currentPlayer: MultiplayerGamePageData["players"][number] | undefined;
  initialGame: MultiplayerGamePageData;
  playersRef: RefObject<MultiplayerGamePageData["players"]>;
  setGame: (updater: (prev: MultiplayerGamePageData) => MultiplayerGamePageData) => void;
  setWinner: (winner: MultiplayerGamePageData["winner"]) => void;
  supabase: SupabaseClient;
  transitions: Transitions;
}>;

/**
 * Sets up the Supabase Realtime channel for the multiplayer game,
 * including presence sync and broadcast listeners.
 *
 * Returns the current presence list.
 */
export function useGameRealtimeChannel({
  channelRef,
  clearDisconnectGrace,
  clearFailedPlacementTimeout,
  clearProgressionTimeout,
  currentPlayer,
  initialGame,
  playersRef,
  setGame,
  setWinner,
  supabase,
  transitions,
}: UseGameRealtimeChannelParams) {
  const {
    applyChallengeMade,
    applyExpertVerificationResult,
    applyGameOver,
    applyPlacementMade,
    applyPlatformBonusResult,
    applyTeamGameOver,
    applyTeamVoteResolved,
    applyTeamVoteUpdated,
    applyTurnRevealed,
    applyTurnSkipped,
    applyTurnStarted,
  } = transitions;

  const [presence, setPresence] = useState<LobbyPresence[]>(() =>
    buildSeedPresence(initialGame.players),
  );

  useEffect(() => {
    if (currentPlayer === undefined) {
      throw new Error("Current player was missing from the multiplayer game payload.");
    }

    const channel = supabase.channel(`room:${initialGame.roomId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: initialGame.currentUserId },
      },
    });
    channelRef.current = channel;

    const syncPlayers = () => {
      setPresence(
        buildConnectedPresence(
          playersRef.current,
          channel.presenceState<Record<string, unknown>>(),
        ),
      );
    };

    channel
      .on("presence", { event: "sync" }, syncPlayers)
      .on("presence", { event: "join" }, syncPlayers)
      .on("presence", { event: "leave" }, syncPlayers)
      .on("broadcast", { event: "game_started" }, (message) => {
        const parsed = GameStartedPayloadSchema.safeParse(message.payload);
        if (!parsed.success || parsed.data.sessionId !== initialGame.sessionId) return;
        const turnPositionByUserId = new Map(parsed.data.turnOrder.map((userId, i) => [userId, i]));
        setWinner(null);
        setGame((cur) => ({
          ...cur,
          currentTurn: {
            activePlayerId: parsed.data.turnOrder[0] ?? cur.currentTurn.activePlayerId,
            card: buildHiddenTurnCard(parsed.data.firstCard.screenshotImageId),
            phase: "placing",
            phaseDeadline: null,
            platformOptions: [],
            platformBonusPlayerId: null,
          },
          players: [...cur.players]
            .map((p) => {
              const startingCard = parsed.data.startingCards[p.userId];
              return {
                ...p,
                score: 0,
                timeline:
                  startingCard !== undefined
                    ? [buildTimelineCardFromEntry(startingCard)]
                    : p.timeline,
                turnPosition: turnPositionByUserId.get(p.userId) ?? p.turnPosition,
              };
            })
            .sort((a, b) => a.turnPosition - b.turnPosition),
          status: "active",
          turnNumber: 1,
        }));
      })
      .on("broadcast", { event: "placement_made" }, (message) => {
        const parsed = PlacementMadePayloadSchema.safeParse(message.payload);
        if (parsed.success)
          applyPlacementMade(
            parsed.data.activePlayerId,
            parsed.data.position,
            parsed.data.challengeDeadline,
          );
      })
      .on("broadcast", { event: "challenge_made" }, (message) => {
        const parsed = ChallengeMadePayloadSchema.safeParse(message.payload);
        if (parsed.success) applyChallengeMade(parsed.data.displayName);
      })
      .on("broadcast", { event: "turn_started" }, (message) => {
        const parsed = TurnStartedPayloadSchema.safeParse(message.payload);
        if (!parsed.success) return;
        const sid =
          typeof parsed.data.screenshot === "string"
            ? parsed.data.screenshot
            : parsed.data.screenshot.screenshotImageId;
        applyTurnStarted(
          parsed.data.activePlayerId,
          parsed.data.deadline ?? null,
          sid,
          parsed.data.turnNumber,
        );
      })
      .on("broadcast", { event: "turn_revealed" }, (message) => {
        const parsed = TurnRevealedPayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyTurnRevealed({
            card: parsed.data.card,
            isCorrect: parsed.data.isCorrect,
            ...(parsed.data.expertVerificationDeadline === undefined
              ? {}
              : { expertVerificationDeadline: parsed.data.expertVerificationDeadline }),
            ...(parsed.data.platformBonusDeadline === undefined
              ? {}
              : { platformBonusDeadline: parsed.data.platformBonusDeadline }),
            ...(parsed.data.platformOptions === undefined
              ? {}
              : { platformOptions: parsed.data.platformOptions }),
            ...(parsed.data.platformBonusPlayerId === undefined
              ? {}
              : { platformBonusPlayerId: parsed.data.platformBonusPlayerId }),
            position: parsed.data.position,
            scores: parsed.data.scores,
            timelines: parsed.data.timelines,
            tokens: parsed.data.tokens,
            ...(parsed.data.challengeResult === undefined
              ? {}
              : { challengeResult: parsed.data.challengeResult }),
            ...(parsed.data.challengerId === undefined
              ? {}
              : { challengerId: parsed.data.challengerId }),
          });
        }
      })
      .on("broadcast", { event: "platform_bonus_result" }, (message) => {
        const parsed = PlatformBonusResultPayloadSchema.safeParse(message.payload);
        if (parsed.success) applyPlatformBonusResult(parsed.data);
      })
      .on("broadcast", { event: "expert_verification_result" }, (message) => {
        const parsed = ExpertVerificationResultPayloadSchema.safeParse(message.payload);
        if (parsed.success) applyExpertVerificationResult(parsed.data);
      })
      .on("broadcast", { event: "turn_skipped" }, (message) => {
        const parsed = TurnSkippedPayloadSchema.safeParse(message.payload);
        if (parsed.success) applyTurnSkipped();
      })
      .on("broadcast", { event: "game_over" }, (message) => {
        const parsed = GameOverPayloadSchema.safeParse(message.payload);
        if (parsed.success) applyGameOver(parsed.data);
      })
      .on("broadcast", { event: "team_vote_updated" }, (message) => {
        const parsed = TeamVoteUpdatedPayloadSchema.safeParse(message.payload);
        if (parsed.success) applyTeamVoteUpdated(parsed.data.votes);
      })
      .on("broadcast", { event: "team_vote_resolved" }, (message) => {
        const parsed = TeamVoteResolvedPayloadSchema.safeParse(message.payload);
        if (parsed.success) applyTeamVoteResolved(parsed.data);
      })
      .on("broadcast", { event: "team_game_over" }, (message) => {
        const parsed = TeamGameOverPayloadSchema.safeParse(message.payload);
        if (parsed.success) applyTeamGameOver(parsed.data);
      })
      .subscribe((status) => {
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) return;
        void channel.track(
          LobbyPresenceSchema.parse({
            userId: currentPlayer.userId,
            displayName: currentPlayer.displayName,
            role: currentPlayer.role,
            status: "connected",
            joinedAt: currentPlayer.joinedAt,
          }),
        );
      });

    return () => {
      channelRef.current = null;
      clearDisconnectGrace();
      clearFailedPlacementTimeout();
      clearProgressionTimeout();
      void supabase.removeChannel(channel);
    };
  }, [
    applyChallengeMade,
    applyExpertVerificationResult,
    applyGameOver,
    applyPlacementMade,
    applyPlatformBonusResult,
    applyTeamGameOver,
    applyTeamVoteResolved,
    applyTeamVoteUpdated,
    applyTurnRevealed,
    applyTurnSkipped,
    applyTurnStarted,
    channelRef,
    clearDisconnectGrace,
    clearFailedPlacementTimeout,
    clearProgressionTimeout,
    currentPlayer,
    initialGame.currentUserId,
    initialGame.roomId,
    initialGame.sessionId,
    playersRef,
    setGame,
    setWinner,
    supabase,
  ]);

  return presence;
}
