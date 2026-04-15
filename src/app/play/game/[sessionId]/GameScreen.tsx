// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from "@supabase/realtime-js";
import { Clock3, Signal, Trophy } from "lucide-react";
import {
  proceedFromChallenge,
  submitChallenge,
  submitPlacement,
} from "@/lib/multiplayer/challengeActions";
import {
  proceedFromExpertVerification,
  submitExpertVerification,
} from "@/lib/multiplayer/expertVerificationActions";
import type { TurnFollowUpResult } from "@/lib/multiplayer/gameActionTypes";
import {
  proceedFromPlatformBonus,
  submitPlatformBonus,
} from "@/lib/multiplayer/platformBonusActions";
import { submitTeamVote } from "@/lib/multiplayer/teamVoteActions";
import { skipTurn } from "@/lib/multiplayer/turnActions";
import { LobbyPresenceSchema, type LobbyPresence } from "@/lib/multiplayer/lobby";
import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import { buildConnectedPresence, buildSeedPresence } from "@/lib/multiplayer/presence";
import type {
  ExpertVerificationResultPayload,
  GameOverPayload,
  PlatformBonusResultPayload,
  TeamGameOverPayload,
  TurnRevealedPayload,
  TurnSkippedReason,
} from "@/lib/multiplayer/turns";
import {
  classifyPlacementOutcome,
  extendShareYearRange,
  type ShareOutcome,
  type ShareYearRange,
} from "@/lib/share";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GameCard } from "@/components/game/GameCard";
import { cn } from "@/lib/utils";
import { GamePlayerTimeline } from "./GamePlayerTimeline";
import {
  buildTimelineCardFromEntry,
  buildHiddenTurnCard,
  ChallengeMadePayloadSchema,
  ExpertVerificationResultPayloadSchema,
  formatCountdown,
  formatPhaseLabel,
  GameOverPayloadSchema,
  GameStartedPayloadSchema,
  getCountdownSeconds,
  isPlayerConnected,
  PlacementMadePayloadSchema,
  PlatformBonusResultPayloadSchema,
  previewFailedReveal,
  previewPlacement,
  reconcilePlayers,
  TeamGameOverPayloadSchema,
  TeamVoteResolvedPayloadSchema,
  TeamVoteUpdatedPayloadSchema,
  TurnRevealedPayloadSchema,
  TurnSkippedPayloadSchema,
  TurnStartedPayloadSchema,
} from "./gameScreenState";
import { MultiplayerGameOverView } from "./MultiplayerGameOverView";
import { MultiplayerChallengePanel } from "./MultiplayerChallengePanel";
import { MultiplayerExpertVerificationPanel } from "./MultiplayerExpertVerificationPanel";
import { MultiplayerPlatformBonusPanel } from "./MultiplayerPlatformBonusPanel";
import { MultiplayerTeamworkGameOver } from "./MultiplayerTeamworkGameOver";
import { TeamVotingPanel } from "./TeamVotingPanel";

const FAILED_PLACEMENT_PREVIEW_MS = 900;
const TURN_FOLLOW_UP_DELAY_MS = 1500;
const ACTIVE_PLAYER_DISCONNECT_GRACE_SECONDS = 30;

type PlacementFeedback = Readonly<{
  gameId: string;
  playerId: string;
  tone: "error";
}> | null;

type PlatformBonusState = PlatformBonusResultPayload | null;

type ExpertVerificationState = ExpertVerificationResultPayload | null;

type DisconnectGraceState = Readonly<{
  deadline: string;
  turnKey: string;
}> | null;

/**
 * Props for the realtime multiplayer game screen.
 */
export type GameScreenProps = Readonly<{
  initialGame: MultiplayerGamePageData;
}>;

/**
 * Client-side multiplayer game screen with realtime state sync and placement UI.
 */
export function GameScreen({ initialGame }: GameScreenProps) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const disconnectCountdownIntervalRef = useRef<number | null>(null);
  const playersRef = useRef(initialGame.players);
  const failedPlacementTimeoutRef = useRef<number | null>(null);
  const progressionTimeoutRef = useRef<number | null>(null);
  const challengeRequestKeyRef = useRef<string | null>(null);
  const platformBonusRequestKeyRef = useRef<string | null>(null);
  const expertVerificationRequestKeyRef = useRef<string | null>(null);
  const skipRequestKeyRef = useRef<string | null>(null);
  const [game, setGame] = useState(initialGame);
  const [presence, setPresence] = useState<LobbyPresence[]>(() =>
    buildSeedPresence(initialGame.players),
  );
  const [winner, setWinner] = useState(initialGame.winner);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() =>
    getCountdownSeconds(initialGame.currentTurn.phaseDeadline),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [challengeNotice, setChallengeNotice] = useState<string | null>(null);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const [disconnectGrace, setDisconnectGrace] = useState<DisconnectGraceState>(null);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);
  const [isSubmittingExpertVerification, setIsSubmittingExpertVerification] = useState(false);
  const [isSubmittingPlatformBonus, setIsSubmittingPlatformBonus] = useState(false);
  const [isSubmittingPlacement, setIsSubmittingPlacement] = useState(false);
  const [isSkippingTurn, setIsSkippingTurn] = useState(false);
  const [placementFeedback, setPlacementFeedback] = useState<PlacementFeedback>(null);
  const [platformBonusResult, setPlatformBonusResult] = useState<PlatformBonusState>(null);
  const [expertVerificationResult, setExpertVerificationResult] =
    useState<ExpertVerificationState>(null);
  const [shareOutcomes, setShareOutcomes] = useState<ShareOutcome[]>([]);
  const [sharePlatformBonusEarned, setSharePlatformBonusEarned] = useState(0);
  const [sharePlatformBonusOpportunities, setSharePlatformBonusOpportunities] = useState(0);
  const [shareYearRange, setShareYearRange] = useState<ShareYearRange | null>(null);
  const [teamGameOver, setTeamGameOver] = useState<TeamGameOverPayload | null>(
    initialGame.status === "finished" && initialGame.settings.gameMode === "teamwork"
      ? initialGame.winner === null
        ? {
            finalTeamScore: initialGame.teamScore ?? 0,
            finalTeamTimeline:
              initialGame.teamTimeline?.map((card) => ({
                gameId: card.gameId,
                name: card.title,
                releaseYear: card.releaseYear,
              })) ?? [],
            teamWin: false,
          }
        : null
      : null,
  );
  const [isSubmittingTeamVote, setIsSubmittingTeamVote] = useState(false);

  playersRef.current = game.players;

  const currentPlayer = useMemo(
    () => game.players.find((player) => player.userId === game.currentUserId),
    [game.currentUserId, game.players],
  );
  const activePlayer = useMemo(
    () => game.players.find((player) => player.userId === game.currentTurn.activePlayerId) ?? null,
    [game.currentTurn.activePlayerId, game.players],
  );
  const platformBonusPlayerId =
    game.currentTurn.platformBonusPlayerId ?? game.currentTurn.activePlayerId;
  const platformBonusPlayer = useMemo(
    () => game.players.find((player) => player.userId === platformBonusPlayerId) ?? null,
    [game.players, platformBonusPlayerId],
  );
  const phasePlayer =
    game.currentTurn.phase === "platform_bonus" || game.currentTurn.phase === "expert_verification"
      ? (platformBonusPlayer ?? activePlayer)
      : activePlayer;
  const placingTurnKey =
    game.currentTurn.phase === "placing"
      ? `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}`
      : null;
  const isActivePlayerConnected =
    activePlayer !== null && isPlayerConnected(presence, activePlayer.userId);
  const effectivePhaseDeadline = useMemo(() => {
    if (
      game.currentTurn.phase !== "placing" ||
      disconnectGrace === null ||
      disconnectGrace.turnKey !== placingTurnKey
    ) {
      return game.currentTurn.phaseDeadline;
    }

    if (!isActivePlayerConnected) {
      return disconnectGrace.deadline;
    }

    if (game.currentTurn.phaseDeadline === null) {
      return disconnectGrace.deadline;
    }

    return new Date(game.currentTurn.phaseDeadline).getTime() >=
      new Date(disconnectGrace.deadline).getTime()
      ? game.currentTurn.phaseDeadline
      : disconnectGrace.deadline;
  }, [
    disconnectGrace,
    game.currentTurn.phase,
    game.currentTurn.phaseDeadline,
    isActivePlayerConnected,
    placingTurnKey,
  ]);
  const showDisconnectNotice =
    disconnectGrace !== null &&
    disconnectGrace.turnKey === placingTurnKey &&
    currentPlayer !== undefined &&
    currentPlayer.userId !== game.currentTurn.activePlayerId &&
    !isActivePlayerConnected;

  const clearFailedPlacementTimeout = useCallback(() => {
    if (failedPlacementTimeoutRef.current !== null) {
      window.clearTimeout(failedPlacementTimeoutRef.current);
      failedPlacementTimeoutRef.current = null;
    }
  }, []);

  const clearProgressionTimeout = useCallback(() => {
    if (progressionTimeoutRef.current !== null) {
      window.clearTimeout(progressionTimeoutRef.current);
      progressionTimeoutRef.current = null;
    }
  }, []);

  const clearDisconnectGrace = useCallback(() => {
    if (disconnectCountdownIntervalRef.current !== null) {
      window.clearInterval(disconnectCountdownIntervalRef.current);
      disconnectCountdownIntervalRef.current = null;
    }
    setDisconnectCountdown(null);
    setDisconnectGrace(null);
  }, []);

  const applyPlacementMade = useCallback(
    (activePlayerId: string, position: number, challengeDeadline?: string) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setPlacementFeedback(null);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
      setGame((current) => ({
        ...current,
        currentTurn: {
          ...current.currentTurn,
          activePlayerId,
          phase: challengeDeadline !== undefined ? "challenge_window" : "revealing",
          phaseDeadline: challengeDeadline ?? null,
          platformOptions: [],
          platformBonusPlayerId: null,
        },
        players: previewPlacement(
          current.players,
          activePlayerId,
          position,
          current.currentTurn.card,
        ),
      }));
    },
    [clearDisconnectGrace, clearFailedPlacementTimeout, clearProgressionTimeout],
  );

  const trackCurrentUserPlacement = useCallback(
    (payload: TurnRevealedPayload) => {
      if (game.currentTurn.activePlayerId === game.currentUserId) {
        const activePlayer = playersRef.current.find(
          (player) => player.userId === game.currentTurn.activePlayerId,
        );
        if (activePlayer !== undefined) {
          setShareOutcomes((previous) => [
            ...previous,
            classifyPlacementOutcome(
              activePlayer.timeline.map((card) => card.releaseYear),
              payload.position,
              payload.card.releaseYear,
            ),
          ]);
          setShareYearRange((previous) => extendShareYearRange(previous, payload.card.releaseYear));
        }
      }

      if (payload.platformBonusPlayerId === game.currentUserId) {
        setSharePlatformBonusOpportunities((previous) => previous + 1);
      }
    },
    [game.currentTurn.activePlayerId, game.currentUserId],
  );

  const applyTurnStarted = useCallback(
    (
      activePlayerId: string,
      deadline: string | null,
      screenshotImageId: string,
      turnNumber: number,
    ) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setIsSkippingTurn(false);
      setIsSubmittingPlacement(false);
      setPlacementFeedback(null);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
      setWinner(null);
      setGame((current) => {
        const isTeamworkMultiplayer =
          current.settings.gameMode === "teamwork" && current.players.length > 1;
        const nextPhase = isTeamworkMultiplayer ? ("team_voting" as const) : ("placing" as const);
        return {
          ...current,
          currentTurn: {
            activePlayerId,
            card: buildHiddenTurnCard(screenshotImageId),
            phase: nextPhase,
            phaseDeadline: deadline,
            platformOptions: [],
            platformBonusPlayerId: null,
            ...(isTeamworkMultiplayer ? { votes: {} } : {}),
          },
          status: "active",
          turnNumber,
        };
      });
    },
    [clearDisconnectGrace, clearFailedPlacementTimeout, clearProgressionTimeout],
  );

  const applyTurnSkipped = useCallback(() => {
    clearFailedPlacementTimeout();
    clearDisconnectGrace();
    clearProgressionTimeout();
    setChallengeNotice(null);
    setIsSubmittingChallenge(false);
    setIsSubmittingExpertVerification(false);
    setIsSubmittingPlatformBonus(false);
    setPlacementFeedback(null);
    setExpertVerificationResult(null);
    setPlatformBonusResult(null);
    setGame((current) => ({
      ...current,
      currentTurn: {
        ...current.currentTurn,
        phase: "drawing",
        phaseDeadline: null,
        platformOptions: [],
        platformBonusPlayerId: null,
      },
      players: current.players.map((player) =>
        player.userId === current.currentTurn.activePlayerId
          ? {
              ...player,
              timeline: player.timeline.filter((card) => card.isRevealed),
            }
          : player,
      ),
    }));
  }, [clearDisconnectGrace, clearFailedPlacementTimeout, clearProgressionTimeout]);

  const applyChallengeMade = useCallback(
    (displayName: string) => {
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(`${displayName} challenged this placement.`);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
      setGame((current) => ({
        ...current,
        currentTurn: {
          ...current.currentTurn,
          phase: "revealing",
          phaseDeadline: null,
          platformOptions: [],
          platformBonusPlayerId: null,
        },
      }));
    },
    [clearDisconnectGrace, clearProgressionTimeout],
  );

  const applyTurnRevealed = useCallback(
    (payload: TurnRevealedPayload) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      setActionError(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setIsSubmittingPlacement(false);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
      trackCurrentUserPlacement(payload);

      let activePlayerId = "";
      let challengeMessage: string | null = null;
      setGame((current) => {
        activePlayerId = current.currentTurn.activePlayerId;
        if (payload.challengerId !== undefined && payload.challengeResult !== undefined) {
          const challenger = current.players.find(
            (player) => player.userId === payload.challengerId,
          );
          if (challenger !== undefined) {
            challengeMessage =
              payload.challengeResult === "challenger_wins"
                ? `${challenger.displayName} challenged successfully and stole the card.`
                : `${challenger.displayName} challenged and lost a token.`;
          }
        }
        const currentTurn = {
          ...current.currentTurn,
          card: {
            coverImageId: payload.card.coverImageId ?? null,
            gameId: payload.card.gameId,
            isRevealed: true,
            platform: payload.card.platform,
            releaseYear: payload.card.releaseYear,
            screenshotImageId: payload.card.screenshotImageId,
            title: payload.card.name,
          },
          phase:
            payload.expertVerificationDeadline !== undefined
              ? ("expert_verification" as const)
              : payload.platformOptions !== undefined
                ? ("platform_bonus" as const)
                : ("revealing" as const),
          phaseDeadline:
            payload.expertVerificationDeadline ?? payload.platformBonusDeadline ?? null,
          platformBonusPlayerId: payload.platformBonusPlayerId ?? null,
          platformOptions: payload.platformOptions ?? current.currentTurn.platformOptions,
        };

        if (!payload.isCorrect) {
          return {
            ...current,
            currentTurn,
            players: previewFailedReveal(
              current.players,
              current.currentTurn.activePlayerId,
              payload.position,
              payload.card,
            ),
          };
        }

        return {
          ...current,
          currentTurn,
          players: reconcilePlayers(
            current.players,
            payload.timelines,
            payload.scores,
            payload.tokens,
            payload.card,
          ),
        };
      });

      if (payload.isCorrect || activePlayerId === "") {
        setPlacementFeedback(null);
        setChallengeNotice(challengeMessage);
        return;
      }

      setPlacementFeedback({
        gameId: String(payload.card.gameId),
        playerId: activePlayerId,
        tone: "error",
      });
      failedPlacementTimeoutRef.current = window.setTimeout(() => {
        setPlacementFeedback(null);
        setGame((current) => ({
          ...current,
          players: reconcilePlayers(
            current.players,
            payload.timelines,
            payload.scores,
            payload.tokens,
            payload.card,
          ),
        }));
      }, FAILED_PLACEMENT_PREVIEW_MS);
      setChallengeNotice(challengeMessage);
    },
    [clearDisconnectGrace, clearFailedPlacementTimeout, trackCurrentUserPlacement],
  );

  const applyPlatformBonusResult = useCallback(
    (payload: PlatformBonusResultPayload) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setPlacementFeedback(null);
      setExpertVerificationResult(null);
      setPlatformBonusResult(payload);
      if (game.currentTurn.platformBonusPlayerId === game.currentUserId && payload.correct) {
        setSharePlatformBonusEarned((previous) => previous + 1);
      }
      setGame((current) => {
        return {
          ...current,
          currentTurn: {
            ...current.currentTurn,
            phase: "complete",
            phaseDeadline: null,
            platformBonusPlayerId: null,
          },
          players: reconcilePlayers(
            current.players,
            payload.timelines,
            payload.scores,
            payload.tokens,
            null,
          ),
        };
      });
    },
    [
      clearDisconnectGrace,
      clearFailedPlacementTimeout,
      clearProgressionTimeout,
      game.currentTurn.platformBonusPlayerId,
      game.currentUserId,
    ],
  );

  const applyExpertVerificationResult = useCallback(
    (payload: ExpertVerificationResultPayload) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setPlacementFeedback(null);
      setPlatformBonusResult(null);
      setExpertVerificationResult(payload);
      if (game.currentTurn.platformBonusPlayerId === game.currentUserId && payload.correct) {
        setSharePlatformBonusEarned((previous) => previous + 1);
      }
      setGame((current) => {
        return {
          ...current,
          currentTurn: {
            ...current.currentTurn,
            phase: "complete",
            phaseDeadline: null,
            platformBonusPlayerId: null,
          },
          players: reconcilePlayers(
            current.players,
            payload.timelines,
            payload.scores,
            payload.tokens,
            null,
          ),
        };
      });
    },
    [
      clearDisconnectGrace,
      clearFailedPlacementTimeout,
      clearProgressionTimeout,
      game.currentTurn.platformBonusPlayerId,
      game.currentUserId,
    ],
  );

  const applyGameOver = useCallback(
    (payload: GameOverPayload) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setChallengeNotice(null);
      setIsSubmittingChallenge(false);
      setIsSubmittingExpertVerification(false);
      setIsSubmittingPlatformBonus(false);
      setIsSkippingTurn(false);
      setIsSubmittingPlacement(false);
      setPlacementFeedback(null);
      setExpertVerificationResult(null);
      setPlatformBonusResult(null);
      setWinner({ displayName: payload.displayName, userId: payload.winnerId });
      setGame((current) => ({
        ...current,
        currentTurn: {
          ...current.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          platformOptions: [],
          platformBonusPlayerId: null,
        },
        players: reconcilePlayers(
          current.players,
          payload.finalTimelines,
          payload.finalScores,
          Object.fromEntries(current.players.map((player) => [player.userId, player.tokens])),
          null,
        ),
        status: "finished",
      }));
    },
    [clearDisconnectGrace, clearFailedPlacementTimeout, clearProgressionTimeout],
  );

  const applyTeamVoteUpdated = useCallback(
    (votes: Record<string, { position: number; locked: boolean }>) => {
      setGame((current) => ({
        ...current,
        currentTurn: { ...current.currentTurn, votes },
      }));
    },
    [],
  );

  const applyTeamVoteResolved = useCallback(
    (payload: {
      correct: boolean;
      teamScore: number;
      teamTimeline: readonly { gameId: number; name: string; releaseYear: number }[];
      teamTokens: number;
    }) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setIsSubmittingTeamVote(false);
      setGame((current) => ({
        ...current,
        currentTurn: {
          ...current.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          votes: {},
        },
        teamScore: payload.teamScore,
        teamTimeline: payload.teamTimeline.map((entry) => ({
          coverImageId: null,
          gameId: entry.gameId,
          isRevealed: true,
          platform: "",
          releaseYear: entry.releaseYear,
          screenshotImageId: null,
          title: entry.name,
        })),
        teamTokens: payload.teamTokens,
      }));
    },
    [clearDisconnectGrace, clearFailedPlacementTimeout, clearProgressionTimeout],
  );

  const applyTeamGameOver = useCallback(
    (payload: TeamGameOverPayload) => {
      clearFailedPlacementTimeout();
      clearDisconnectGrace();
      clearProgressionTimeout();
      setActionError(null);
      setIsSubmittingTeamVote(false);
      setIsSkippingTurn(false);
      setIsSubmittingPlacement(false);
      setTeamGameOver(payload);
      setGame((current) => ({
        ...current,
        currentTurn: {
          ...current.currentTurn,
          phase: "complete",
          phaseDeadline: null,
          votes: {},
        },
        status: "finished",
      }));
    },
    [clearDisconnectGrace, clearFailedPlacementTimeout, clearProgressionTimeout],
  );

  const scheduleFollowUp = useCallback(
    (followUp: TurnFollowUpResult) => {
      clearProgressionTimeout();
      progressionTimeoutRef.current = window.setTimeout(() => {
        if (followUp.type === "next_turn") {
          applyTurnStarted(
            followUp.nextTurn.activePlayerId,
            followUp.nextTurn.deadline,
            followUp.nextTurn.screenshot.screenshotImageId,
            followUp.nextTurn.turnNumber,
          );
          void channelRef.current?.send({
            type: "broadcast",
            event: "turn_started",
            payload: followUp.nextTurn,
          });
          return;
        }

        if (followUp.type === "team_game_over") {
          applyTeamGameOver(followUp.gameOver);
          void channelRef.current?.send({
            type: "broadcast",
            event: "team_game_over",
            payload: followUp.gameOver,
          });
          return;
        }

        applyGameOver(followUp.gameOver);
        void channelRef.current?.send({
          type: "broadcast",
          event: "game_over",
          payload: followUp.gameOver,
        });
      }, TURN_FOLLOW_UP_DELAY_MS);
    },
    [applyGameOver, applyTeamGameOver, applyTurnStarted, clearProgressionTimeout],
  );

  useEffect(() => {
    if (disconnectGrace === null) {
      if (disconnectCountdownIntervalRef.current !== null) {
        window.clearInterval(disconnectCountdownIntervalRef.current);
        disconnectCountdownIntervalRef.current = null;
      }
      setDisconnectCountdown(null);
      return;
    }

    const updateCountdown = () => {
      setDisconnectCountdown(getCountdownSeconds(disconnectGrace.deadline));
    };

    updateCountdown();
    if (disconnectCountdownIntervalRef.current !== null) {
      window.clearInterval(disconnectCountdownIntervalRef.current);
    }
    disconnectCountdownIntervalRef.current = window.setInterval(updateCountdown, 1000);

    return () => {
      if (disconnectCountdownIntervalRef.current !== null) {
        window.clearInterval(disconnectCountdownIntervalRef.current);
        disconnectCountdownIntervalRef.current = null;
      }
    };
  }, [disconnectGrace]);

  useEffect(() => {
    if (placingTurnKey === null || currentPlayer === undefined) {
      clearDisconnectGrace();
      return;
    }

    if (disconnectGrace !== null && disconnectGrace.turnKey !== placingTurnKey) {
      clearDisconnectGrace();
      return;
    }

    if (
      disconnectGrace === null &&
      currentPlayer.userId !== game.currentTurn.activePlayerId &&
      !isActivePlayerConnected
    ) {
      setDisconnectGrace({
        deadline: new Date(
          Date.now() + ACTIVE_PLAYER_DISCONNECT_GRACE_SECONDS * 1000,
        ).toISOString(),
        turnKey: placingTurnKey,
      });
      setDisconnectCountdown(ACTIVE_PLAYER_DISCONNECT_GRACE_SECONDS);
    }
  }, [
    clearDisconnectGrace,
    currentPlayer,
    disconnectGrace,
    game.currentTurn.activePlayerId,
    isActivePlayerConnected,
    placingTurnKey,
  ]);

  useEffect(() => {
    setSecondsRemaining(getCountdownSeconds(effectivePhaseDeadline));

    if (effectivePhaseDeadline === null) {
      return;
    }

    const timerId = window.setInterval(() => {
      setSecondsRemaining(getCountdownSeconds(effectivePhaseDeadline));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [effectivePhaseDeadline]);

  const handleSkipTurn = useCallback(
    async (reason: TurnSkippedReason) => {
      setIsSkippingTurn(true);
      setActionError(null);

      const result = await skipTurn(game.sessionId, {
        presenceUserIds: presence.map((player) => player.userId),
        reason,
      });
      if (!result.success) {
        setIsSkippingTurn(false);
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
        }
        return;
      }

      applyTurnSkipped();
      void channelRef.current?.send({
        type: "broadcast",
        event: "turn_skipped",
        payload: result.data.skipped,
      });
      if (result.data.followUp.type === "next_turn") {
        applyTurnStarted(
          result.data.followUp.nextTurn.activePlayerId,
          result.data.followUp.nextTurn.deadline,
          result.data.followUp.nextTurn.screenshot.screenshotImageId,
          result.data.followUp.nextTurn.turnNumber,
        );
        void channelRef.current?.send({
          type: "broadcast",
          event: "turn_started",
          payload: result.data.followUp.nextTurn,
        });
        return;
      }

      if (result.data.followUp.type === "team_game_over") {
        applyTeamGameOver(result.data.followUp.gameOver);
        void channelRef.current?.send({
          type: "broadcast",
          event: "team_game_over",
          payload: result.data.followUp.gameOver,
        });
        return;
      }

      applyGameOver(result.data.followUp.gameOver);
      void channelRef.current?.send({
        type: "broadcast",
        event: "game_over",
        payload: result.data.followUp.gameOver,
      });
    },
    [
      applyGameOver,
      applyTeamGameOver,
      applyTurnSkipped,
      applyTurnStarted,
      game.sessionId,
      presence,
    ],
  );

  const handleProceedFromChallenge = useCallback(async () => {
    setActionError(null);

    const result = await proceedFromChallenge(game.sessionId);
    if (!result.success) {
      if (result.error.code !== "CONFLICT") {
        setActionError(result.error.message);
      }
      return;
    }

    applyTurnRevealed(result.data.reveal);
    void channelRef.current?.send({
      type: "broadcast",
      event: "turn_revealed",
      payload: result.data.reveal,
    });
    if (result.data.followUp !== undefined) {
      scheduleFollowUp(result.data.followUp);
    }
  }, [applyTurnRevealed, game.sessionId, scheduleFollowUp]);

  const handleChallenge = useCallback(async () => {
    if (
      currentPlayer === undefined ||
      currentPlayer.userId === game.currentTurn.activePlayerId ||
      currentPlayer.tokens < 1 ||
      game.currentTurn.phase !== "challenge_window"
    ) {
      return;
    }

    setIsSubmittingChallenge(true);
    setActionError(null);

    const result = await submitChallenge(game.sessionId);
    if (!result.success) {
      setIsSubmittingChallenge(false);
      if (result.error.code !== "CONFLICT") {
        setActionError(result.error.message);
      }
      return;
    }

    applyChallengeMade(result.data.challenge.displayName);
    void channelRef.current?.send({
      type: "broadcast",
      event: "challenge_made",
      payload: result.data.challenge,
    });
    applyTurnRevealed(result.data.reveal);
    void channelRef.current?.send({
      type: "broadcast",
      event: "turn_revealed",
      payload: result.data.reveal,
    });
    if (result.data.followUp !== undefined) {
      scheduleFollowUp(result.data.followUp);
    }
  }, [
    applyChallengeMade,
    applyTurnRevealed,
    currentPlayer,
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.sessionId,
    scheduleFollowUp,
  ]);

  const handleProceedFromPlatformBonus = useCallback(async () => {
    setActionError(null);

    const result = await proceedFromPlatformBonus(game.sessionId);
    if (!result.success) {
      if (result.error.code !== "CONFLICT") {
        setActionError(result.error.message);
      }
      return;
    }

    applyPlatformBonusResult(result.data.bonus);
    void channelRef.current?.send({
      type: "broadcast",
      event: "platform_bonus_result",
      payload: result.data.bonus,
    });
    scheduleFollowUp(result.data.followUp);
  }, [applyPlatformBonusResult, game.sessionId, scheduleFollowUp]);

  const handleSubmitPlatformBonus = useCallback(
    async (selectedPlatformIds: number[]) => {
      if (
        currentPlayer === undefined ||
        currentPlayer.userId !== platformBonusPlayerId ||
        game.currentTurn.phase !== "platform_bonus"
      ) {
        return;
      }

      setIsSubmittingPlatformBonus(true);
      setActionError(null);

      const result = await submitPlatformBonus(game.sessionId, selectedPlatformIds);
      if (!result.success) {
        setIsSubmittingPlatformBonus(false);
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
        }
        return;
      }

      applyPlatformBonusResult(result.data.bonus);
      void channelRef.current?.send({
        type: "broadcast",
        event: "platform_bonus_result",
        payload: result.data.bonus,
      });
      scheduleFollowUp(result.data.followUp);
    },
    [
      applyPlatformBonusResult,
      currentPlayer,
      game.currentTurn.phase,
      game.sessionId,
      platformBonusPlayerId,
      scheduleFollowUp,
    ],
  );

  useEffect(() => {
    if (game.currentTurn.phase !== "placing" || secondsRemaining !== 0) {
      return;
    }

    const skipReason: TurnSkippedReason = isActivePlayerConnected
      ? "turn_timer_expired"
      : "disconnect_timeout";
    const requestKey = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:${skipReason}`;
    if (skipRequestKeyRef.current === requestKey) {
      return;
    }

    skipRequestKeyRef.current = requestKey;
    void handleSkipTurn(skipReason);
  }, [
    isActivePlayerConnected,
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleSkipTurn,
    secondsRemaining,
  ]);

  useEffect(() => {
    if (game.currentTurn.phase !== "challenge_window" || secondsRemaining !== 0) {
      return;
    }

    const requestKey = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:challenge`;
    if (challengeRequestKeyRef.current === requestKey) {
      return;
    }

    challengeRequestKeyRef.current = requestKey;
    void handleProceedFromChallenge();
  }, [
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleProceedFromChallenge,
    secondsRemaining,
  ]);

  useEffect(() => {
    if (game.currentTurn.phase !== "platform_bonus" || secondsRemaining !== 0) {
      return;
    }

    const requestKey = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:platform_bonus`;
    if (platformBonusRequestKeyRef.current === requestKey) {
      return;
    }

    platformBonusRequestKeyRef.current = requestKey;
    void handleProceedFromPlatformBonus();
  }, [
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleProceedFromPlatformBonus,
    secondsRemaining,
  ]);

  const handleProceedFromExpertVerification = useCallback(async () => {
    setActionError(null);

    const result = await proceedFromExpertVerification(game.sessionId);
    if (!result.success) {
      if (result.error.code !== "CONFLICT") {
        setActionError(result.error.message);
      }
      return;
    }

    applyExpertVerificationResult(result.data.verification);
    void channelRef.current?.send({
      type: "broadcast",
      event: "expert_verification_result",
      payload: result.data.verification,
    });
    scheduleFollowUp(result.data.followUp);
  }, [applyExpertVerificationResult, game.sessionId, scheduleFollowUp]);

  const handleSubmitExpertVerification = useCallback(
    async (yearGuess: number, selectedPlatformIds: number[]) => {
      if (
        currentPlayer === undefined ||
        currentPlayer.userId !== platformBonusPlayerId ||
        game.currentTurn.phase !== "expert_verification"
      ) {
        return;
      }

      setIsSubmittingExpertVerification(true);
      setActionError(null);

      const result = await submitExpertVerification(game.sessionId, yearGuess, selectedPlatformIds);
      if (!result.success) {
        setIsSubmittingExpertVerification(false);
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
        }
        return;
      }

      applyExpertVerificationResult(result.data.verification);
      void channelRef.current?.send({
        type: "broadcast",
        event: "expert_verification_result",
        payload: result.data.verification,
      });
      scheduleFollowUp(result.data.followUp);
    },
    [
      applyExpertVerificationResult,
      currentPlayer,
      game.currentTurn.phase,
      game.sessionId,
      platformBonusPlayerId,
      scheduleFollowUp,
    ],
  );

  useEffect(() => {
    if (game.currentTurn.phase !== "expert_verification" || secondsRemaining !== 0) {
      return;
    }

    const requestKey = `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}:expert_verification`;
    if (expertVerificationRequestKeyRef.current === requestKey) {
      return;
    }

    expertVerificationRequestKeyRef.current = requestKey;
    void handleProceedFromExpertVerification();
  }, [
    game.currentTurn.activePlayerId,
    game.currentTurn.phase,
    game.turnNumber,
    handleProceedFromExpertVerification,
    secondsRemaining,
  ]);

  const handleTeamVote = useCallback(
    async (position: number, locked: boolean) => {
      if (
        currentPlayer === undefined ||
        game.currentTurn.phase !== "team_voting" ||
        game.status !== "active"
      ) {
        return;
      }

      setIsSubmittingTeamVote(true);
      setActionError(null);

      const result = await submitTeamVote(
        game.sessionId,
        position,
        locked,
        presence.map((p) => p.userId),
      );
      setIsSubmittingTeamVote(false);

      if (!result.success) {
        if (result.error.code !== "CONFLICT") {
          setActionError(result.error.message);
        }
        return;
      }

      if (result.data.type === "vote_updated") {
        applyTeamVoteUpdated(result.data.votePayload.votes);
        void channelRef.current?.send({
          type: "broadcast",
          event: "team_vote_updated",
          payload: { votes: result.data.votePayload.votes },
        });
        return;
      }

      applyTeamVoteResolved(result.data.resolvedPayload);
      void channelRef.current?.send({
        type: "broadcast",
        event: "team_vote_resolved",
        payload: result.data.resolvedPayload,
      });
      scheduleFollowUp(result.data.followUp);
    },
    [
      applyTeamVoteResolved,
      applyTeamVoteUpdated,
      currentPlayer,
      game.currentTurn.phase,
      game.sessionId,
      game.status,
      presence,
      scheduleFollowUp,
    ],
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
        if (!parsed.success || parsed.data.sessionId !== initialGame.sessionId) {
          return;
        }

        const turnPositionByUserId = new Map(
          parsed.data.turnOrder.map((userId, index) => [userId, index]),
        );

        setWinner(null);
        setGame((current) => ({
          ...current,
          currentTurn: {
            activePlayerId: parsed.data.turnOrder[0] ?? current.currentTurn.activePlayerId,
            card: buildHiddenTurnCard(parsed.data.firstCard.screenshotImageId),
            phase: "placing",
            phaseDeadline: null,
            platformOptions: [],
            platformBonusPlayerId: null,
          },
          players: [...current.players]
            .map((player) => {
              const startingCard = parsed.data.startingCards[player.userId];
              return {
                ...player,
                score: 0,
                timeline:
                  startingCard !== undefined
                    ? [buildTimelineCardFromEntry(startingCard)]
                    : player.timeline,
                turnPosition: turnPositionByUserId.get(player.userId) ?? player.turnPosition,
              };
            })
            .sort((left, right) => left.turnPosition - right.turnPosition),
          status: "active",
          turnNumber: 1,
        }));
      })
      .on("broadcast", { event: "placement_made" }, (message) => {
        const parsed = PlacementMadePayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyPlacementMade(
            parsed.data.activePlayerId,
            parsed.data.position,
            parsed.data.challengeDeadline,
          );
        }
      })
      .on("broadcast", { event: "challenge_made" }, (message) => {
        const parsed = ChallengeMadePayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyChallengeMade(parsed.data.displayName);
        }
      })
      .on("broadcast", { event: "turn_started" }, (message) => {
        const parsed = TurnStartedPayloadSchema.safeParse(message.payload);
        if (!parsed.success) {
          return;
        }

        const screenshotImageId =
          typeof parsed.data.screenshot === "string"
            ? parsed.data.screenshot
            : parsed.data.screenshot.screenshotImageId;
        applyTurnStarted(
          parsed.data.activePlayerId,
          parsed.data.deadline ?? null,
          screenshotImageId,
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
        if (parsed.success) {
          applyPlatformBonusResult(parsed.data);
        }
      })
      .on("broadcast", { event: "expert_verification_result" }, (message) => {
        const parsed = ExpertVerificationResultPayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyExpertVerificationResult(parsed.data);
        }
      })
      .on("broadcast", { event: "turn_skipped" }, (message) => {
        const parsed = TurnSkippedPayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyTurnSkipped();
        }
      })
      .on("broadcast", { event: "game_over" }, (message) => {
        const parsed = GameOverPayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyGameOver(parsed.data);
        }
      })
      .on("broadcast", { event: "team_vote_updated" }, (message) => {
        const parsed = TeamVoteUpdatedPayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyTeamVoteUpdated(parsed.data.votes);
        }
      })
      .on("broadcast", { event: "team_vote_resolved" }, (message) => {
        const parsed = TeamVoteResolvedPayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyTeamVoteResolved(parsed.data);
        }
      })
      .on("broadcast", { event: "team_game_over" }, (message) => {
        const parsed = TeamGameOverPayloadSchema.safeParse(message.payload);
        if (parsed.success) {
          applyTeamGameOver(parsed.data);
        }
      })
      .subscribe((status) => {
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          return;
        }

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
    applyGameOver,
    applyTeamGameOver,
    applyTeamVoteResolved,
    applyTeamVoteUpdated,
    applyChallengeMade,
    applyExpertVerificationResult,
    applyPlatformBonusResult,
    applyPlacementMade,
    applyTurnRevealed,
    applyTurnSkipped,
    applyTurnStarted,
    clearDisconnectGrace,
    clearFailedPlacementTimeout,
    clearProgressionTimeout,
    currentPlayer,
    initialGame.currentUserId,
    initialGame.roomId,
    initialGame.sessionId,
    supabase,
  ]);

  const handlePlaceCard = useCallback(
    async (position: number) => {
      if (
        game.currentTurn.phase !== "placing" ||
        game.currentTurn.activePlayerId !== game.currentUserId ||
        currentPlayer === undefined
      ) {
        return;
      }

      const previousPlayers = game.players;
      const previousTurn = game.currentTurn;
      setIsSubmittingPlacement(true);
      setActionError(null);
      applyPlacementMade(
        game.currentUserId,
        position,
        game.settings.tokensEnabled ? new Date(Date.now() + 10_000).toISOString() : undefined,
      );

      const result = await submitPlacement(game.sessionId, position);
      if (!result.success) {
        setIsSubmittingPlacement(false);
        setActionError(result.error.message);
        clearFailedPlacementTimeout();
        setPlacementFeedback(null);
        setGame((current) => ({
          ...current,
          currentTurn: previousTurn,
          players: previousPlayers,
        }));
        return;
      }

      setIsSubmittingPlacement(false);

      void channelRef.current?.send({
        type: "broadcast",
        event: "placement_made",
        payload: result.data.placement,
      });

      if (result.data.type === "challenge_window") {
        applyPlacementMade(
          result.data.placement.activePlayerId,
          result.data.placement.position,
          result.data.placement.challengeDeadline,
        );
        return;
      }

      applyTurnRevealed(result.data.reveal);
      void channelRef.current?.send({
        type: "broadcast",
        event: "turn_revealed",
        payload: result.data.reveal,
      });
      if (result.data.followUp !== undefined) {
        scheduleFollowUp(result.data.followUp);
      }
    },
    [
      applyPlacementMade,
      applyTurnRevealed,
      clearFailedPlacementTimeout,
      currentPlayer,
      game.currentTurn,
      game.currentUserId,
      game.players,
      game.sessionId,
      game.settings.tokensEnabled,
      scheduleFollowUp,
    ],
  );

  if (currentPlayer === undefined) {
    throw new Error("Current player was missing from the multiplayer game payload.");
  }

  if (teamGameOver !== null && game.status === "finished") {
    return (
      <MultiplayerTeamworkGameOver
        finalTeamScore={teamGameOver.finalTeamScore}
        finalTeamTimeline={game.teamTimeline ?? []}
        teamWin={teamGameOver.teamWin}
      />
    );
  }

  if (winner !== null && game.status === "finished") {
    return (
      <MultiplayerGameOverView
        connectedUserIds={presence.map((player) => player.userId)}
        currentUserId={game.currentUserId}
        difficulty={game.settings.difficulty}
        players={game.players}
        shareOutcomes={shareOutcomes}
        sharePlatformBonusEarned={sharePlatformBonusEarned}
        sharePlatformBonusOpportunities={sharePlatformBonusOpportunities}
        shareYearRange={shareYearRange}
        winCondition={game.settings.winCondition}
        winner={winner}
      />
    );
  }

  const isTeamworkMode = game.settings.gameMode === "teamwork";
  const isTeamVoting = game.currentTurn.phase === "team_voting";
  const isChallengeWindow = game.currentTurn.phase === "challenge_window";
  const isExpertVerificationVisible =
    game.currentTurn.phase === "expert_verification" || expertVerificationResult !== null;
  const isPlatformBonusVisible =
    game.currentTurn.phase === "platform_bonus" || platformBonusResult !== null;
  const canChallenge =
    !isTeamworkMode &&
    isChallengeWindow &&
    currentPlayer.userId !== game.currentTurn.activePlayerId &&
    currentPlayer.tokens > 0 &&
    !isSubmittingChallenge;

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="w-full max-w-7xl space-y-6">
        <Card className="border-border/60 bg-surface-800/70">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Trophy className="text-primary-400 h-5 w-5" />
                  {isTeamworkMode ? "Co-op Game" : "Multiplayer Game"}
                </CardTitle>
                <CardDescription>
                  {isTeamworkMode
                    ? isTeamVoting
                      ? "Vote together on where this game belongs in the shared timeline"
                      : `Phase: ${formatPhaseLabel(game.currentTurn.phase)}`
                    : activePlayer !== null
                      ? `${(phasePlayer ?? activePlayer).displayName}'s turn — ${formatPhaseLabel(game.currentTurn.phase)}`
                      : `Phase: ${formatPhaseLabel(game.currentTurn.phase)}`}
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  Turn {game.turnNumber}
                </span>
                {isTeamworkMode ? (
                  <>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                      Score: {game.teamScore ?? 0} / {game.settings.winCondition}
                    </span>
                    <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-rose-200">
                      {"❤️".repeat(Math.max(0, game.teamTokens ?? 5))} {game.teamTokens ?? 5} lives
                    </span>
                  </>
                ) : (
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                    First to {game.settings.winCondition}
                  </span>
                )}
                {secondsRemaining !== null ? (
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                    <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                    {formatCountdown(secondsRemaining)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="text-text-secondary flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <Signal className="h-4 w-4" />
                {presence.length}/{game.players.length} players connected
              </span>
              <span>Room session: {game.sessionId}</span>
            </div>

            {winner !== null ? (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                <strong>{winner.displayName}</strong> has won the game.
              </div>
            ) : null}

            {showDisconnectNotice && disconnectCountdown !== null && activePlayer !== null ? (
              <div
                className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                role="alert"
              >
                <strong>{activePlayer.displayName}</strong> disconnected — waiting{" "}
                {disconnectCountdown}s before skipping the turn.
              </div>
            ) : null}

            {actionError !== null ? (
              <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {actionError}
              </div>
            ) : null}
          </CardHeader>
        </Card>

        {isTeamworkMode && isTeamVoting ? (
          <Card className="border-border/60 bg-surface-800/70">
            <CardHeader>
              <CardTitle>Team Vote</CardTitle>
            </CardHeader>
            <div className="px-6 pb-6">
              <TeamVotingPanel
                currentUserId={game.currentUserId}
                votes={game.currentTurn.votes ?? {}}
                players={game.players}
                teamTimeline={game.teamTimeline ?? []}
                isSubmitting={isSubmittingTeamVote}
                onPositionChange={(position) => {
                  void handleTeamVote(position, false);
                }}
                onLockIn={(position) => {
                  void handleTeamVote(position, true);
                }}
              />
            </div>
          </Card>
        ) : null}

        {!isTeamworkMode ? (
          <MultiplayerChallengePanel
            activePlayerName={activePlayer?.displayName ?? null}
            canChallenge={canChallenge}
            challengeNotice={challengeNotice}
            isCurrentUserActive={currentPlayer.userId === game.currentTurn.activePlayerId}
            isSubmittingChallenge={isSubmittingChallenge}
            isVisible={isChallengeWindow}
            onChallenge={() => {
              void handleChallenge();
            }}
            playerTokens={currentPlayer.tokens}
            secondsRemaining={secondsRemaining}
          />
        ) : null}

        <MultiplayerPlatformBonusPanel
          activePlayerName={platformBonusPlayer?.displayName ?? activePlayer?.displayName ?? null}
          isCurrentUserActive={currentPlayer.userId === platformBonusPlayerId}
          isPro={game.settings.variant === "pro"}
          isSubmittingPlatformBonus={isSubmittingPlatformBonus}
          isVisible={isPlatformBonusVisible}
          onSubmit={(selectedPlatformIds: number[]) => {
            void handleSubmitPlatformBonus(selectedPlatformIds);
          }}
          options={game.currentTurn.platformOptions}
          result={platformBonusResult}
          secondsRemaining={game.currentTurn.phase === "platform_bonus" ? secondsRemaining : null}
        />

        <MultiplayerExpertVerificationPanel
          activePlayerName={platformBonusPlayer?.displayName ?? activePlayer?.displayName ?? null}
          isCurrentUserActive={currentPlayer.userId === platformBonusPlayerId}
          isSubmittingExpertVerification={isSubmittingExpertVerification}
          isVisible={isExpertVerificationVisible}
          onSubmit={(yearGuess: number, selectedPlatformIds: number[]) => {
            void handleSubmitExpertVerification(yearGuess, selectedPlatformIds);
          }}
          options={game.currentTurn.platformOptions}
          result={expertVerificationResult}
          secondsRemaining={
            game.currentTurn.phase === "expert_verification" ? secondsRemaining : null
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card className="border-border/60 bg-surface-800/70">
            <CardHeader>
              <CardTitle>Current Card</CardTitle>
              <CardDescription>
                {isTeamworkMode
                  ? "Everyone votes on where this game fits in the shared timeline."
                  : "Everyone can inspect the current screenshot while the active player decides."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <GameCard
                screenshotImageId={game.currentTurn.card.screenshotImageId}
                coverImageId={game.currentTurn.card.coverImageId}
                title={game.currentTurn.card.title}
                releaseYear={game.currentTurn.card.releaseYear ?? 0}
                platform={game.currentTurn.card.platform}
                isRevealed={game.currentTurn.card.isRevealed}
              />
              <div
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-sm",
                  game.currentTurn.card.isRevealed
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-black/20 text-slate-200",
                )}
              >
                <p className="font-medium">
                  {game.currentTurn.card.isRevealed
                    ? `${game.currentTurn.card.title} (${String(game.currentTurn.card.releaseYear ?? "")})`
                    : "Screenshot visible to all players"}
                </p>
                <p className="text-xs text-inherit/80">
                  {game.currentTurn.card.isRevealed
                    ? game.currentTurn.card.platform || "Platform details pending"
                    : isTeamworkMode
                      ? "Vote on where this game belongs."
                      : `Waiting on ${activePlayer?.displayName ?? "the active player"} to finish this phase.`}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {isTeamworkMode ? (
              <div className="md:col-span-2">
                <Card className="border-border/60 bg-surface-800/70">
                  <CardHeader>
                    <CardTitle>Shared Timeline</CardTitle>
                  </CardHeader>
                  <div className="px-6 pb-6">
                    {(game.teamTimeline ?? []).length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No cards placed yet — the first card will be revealed soon.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(game.teamTimeline ?? []).map((card) => (
                          <div
                            key={card.gameId}
                            className="bg-muted/50 flex items-center justify-between rounded px-3 py-2 text-sm"
                          >
                            <span>{card.title}</span>
                            <span className="text-muted-foreground font-mono">
                              {card.releaseYear}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              game.players.map((player) => {
                const playerIsConnected = isPlayerConnected(presence, player.userId);
                const isDisconnectedActivePlayer =
                  disconnectGrace !== null &&
                  disconnectGrace.turnKey === placingTurnKey &&
                  player.userId === game.currentTurn.activePlayerId &&
                  !playerIsConnected;
                const canPlaceCard =
                  player.userId === game.currentUserId &&
                  player.userId === game.currentTurn.activePlayerId &&
                  game.currentTurn.phase === "placing" &&
                  !isSubmittingPlacement &&
                  !isSkippingTurn;

                return (
                  <GamePlayerTimeline
                    key={player.userId}
                    highlightedCardId={
                      placementFeedback?.playerId === player.userId
                        ? placementFeedback.gameId
                        : null
                    }
                    highlightedCardTone={
                      placementFeedback?.playerId === player.userId ? placementFeedback.tone : null
                    }
                    activityBadgeLabel={
                      isDisconnectedActivePlayer && disconnectCountdown !== null
                        ? `Reconnecting ${String(disconnectCountdown)}s`
                        : null
                    }
                    connectionLabel={
                      isDisconnectedActivePlayer && disconnectCountdown !== null
                        ? `Disconnected — waiting ${String(disconnectCountdown)}s`
                        : playerIsConnected
                          ? "Connected"
                          : "Disconnected"
                    }
                    isActive={player.userId === game.currentTurn.activePlayerId}
                    isConnected={playerIsConnected}
                    isCurrentUser={player.userId === game.currentUserId}
                    pendingTurnCard={canPlaceCard ? game.currentTurn.card : null}
                    player={player}
                    winCondition={game.settings.winCondition}
                    {...(canPlaceCard
                      ? {
                          onPlaceCard: (position: number) => {
                            void handlePlaceCard(position);
                          },
                        }
                      : {})}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
