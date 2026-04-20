// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/realtime-js";
import type { TeamGameOverPayload } from "@/lib/multiplayer/turns";
import type { ShareOutcome, ShareYearRange } from "@/lib/share";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GameCard } from "@/components/game/GameCard";
import { cn } from "@/lib/utils";
import type {
  DisconnectGraceState,
  ExpertVerificationState,
  GameScreenProps,
  PlacementFeedback,
  PlatformBonusState,
} from "./gameScreenTypes";
import { GamePlayerTimelines } from "./GamePlayerTimelines";
import { GameScreenHeader } from "./GameScreenHeader";
import { MultiplayerChallengePanel } from "./MultiplayerChallengePanel";
import { MultiplayerExpertVerificationPanel } from "./MultiplayerExpertVerificationPanel";
import { MultiplayerGameOverView } from "./MultiplayerGameOverView";
import { MultiplayerPlatformBonusPanel } from "./MultiplayerPlatformBonusPanel";
import { MultiplayerTeamworkGameOver } from "./MultiplayerTeamworkGameOver";
import { TeamVotingPanel } from "./TeamVotingPanel";
import { useAutoProgression } from "./useAutoProgression";
import { useGameActions } from "./useGameActions";
import { useGameReconciliation } from "./useGameReconciliation";
import { useGameBonusTransitions } from "./useGameBonusTransitions";
import { useGameRealtimeChannel } from "./useGameRealtimeChannel";
import { useGameStateTransitions } from "./useGameStateTransitions";
import { useGameTimers } from "./useGameTimers";

export type { GameScreenProps } from "./gameScreenTypes";

/** Client-side multiplayer game screen with realtime state sync and placement UI. */
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
  const [winner, setWinner] = useState(initialGame.winner);
  const [actionError, setActionError] = useState<string | null>(null);
  const [challengeNotice, setChallengeNotice] = useState<string | null>(null);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const [disconnectGrace, setDisconnectGrace] = useState<DisconnectGraceState>(null);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);
  const [_isAcceptingChallenge, setIsAcceptingChallenge] = useState(false);
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

  const refs = {
    disconnectCountdownIntervalRef,
    failedPlacementTimeoutRef,
    playersRef,
    progressionTimeoutRef,
  };
  const setters = {
    setActionError,
    setChallengeNotice,
    setDisconnectCountdown,
    setDisconnectGrace,
    setExpertVerificationResult,
    setGame,
    setIsAcceptingChallenge,
    setIsSkippingTurn,
    setIsSubmittingChallenge,
    setIsSubmittingExpertVerification,
    setIsSubmittingPlacement,
    setIsSubmittingPlatformBonus,
    setIsSubmittingTeamVote,
    setPlacementFeedback,
    setPlatformBonusResult,
    setShareOutcomes,
    setSharePlatformBonusEarned,
    setSharePlatformBonusOpportunities,
    setShareYearRange,
    setTeamGameOver,
    setWinner,
  };
  const coreTransitions = useGameStateTransitions(game, refs, setters);
  const bonusTransitions = useGameBonusTransitions(game, setters, {
    resetTransient: coreTransitions.resetTransient,
  });
  const transitions = { ...coreTransitions, ...bonusTransitions };

  const currentPlayer = useMemo(
    () => game.players.find((p) => p.userId === game.currentUserId),
    [game.currentUserId, game.players],
  );
  const platformBonusPlayerId =
    game.currentTurn.platformBonusPlayerId ?? game.currentTurn.activePlayerId;
  const platformBonusPlayer = useMemo(
    () => game.players.find((p) => p.userId === platformBonusPlayerId) ?? null,
    [game.players, platformBonusPlayerId],
  );
  const placingTurnKey =
    game.currentTurn.phase === "placing"
      ? `${String(game.turnNumber)}:${game.currentTurn.activePlayerId}`
      : null;

  const presence = useGameRealtimeChannel({
    channelRef,
    clearDisconnectGrace: transitions.clearDisconnectGrace,
    clearFailedPlacementTimeout: transitions.clearFailedPlacementTimeout,
    clearProgressionTimeout: transitions.clearProgressionTimeout,
    currentPlayer,
    initialGame,
    playersRef,
    setGame,
    setWinner,
    supabase,
    transitions,
  });

  const { activePlayer, isActivePlayerConnected, secondsRemaining } = useGameTimers({
    clearDisconnectGrace: transitions.clearDisconnectGrace,
    currentPlayer,
    disconnectCountdownIntervalRef,
    disconnectGrace,
    game,
    placingTurnKey,
    presence,
    setDisconnectCountdown,
    setDisconnectGrace,
  });

  const phasePlayer =
    game.currentTurn.phase === "platform_bonus" || game.currentTurn.phase === "expert_verification"
      ? (platformBonusPlayer ?? activePlayer)
      : activePlayer;
  const showDisconnectNotice =
    disconnectGrace !== null &&
    disconnectGrace.turnKey === placingTurnKey &&
    currentPlayer !== undefined &&
    currentPlayer.userId !== game.currentTurn.activePlayerId &&
    !isActivePlayerConnected;
  const isTeamworkMode = game.settings.gameMode === "teamwork";

  const actions = useGameActions({
    bonusTransitions,
    challengeRequestKeyRef,
    channelRef,
    coreTransitions,
    currentPlayer,
    expertVerificationRequestKeyRef,
    game,
    platformBonusPlayerId,
    platformBonusRequestKeyRef,
    presence,
    progressionTimeoutRef,
    setActionError,
    setGame,
    setIsAcceptingChallenge,
    setIsSkippingTurn,
    setIsSubmittingChallenge,
    setIsSubmittingExpertVerification,
    setIsSubmittingPlacement,
    setIsSubmittingPlatformBonus,
    setIsSubmittingTeamVote,
    setPlacementFeedback,
    skipRequestKeyRef,
  });

  useAutoProgression({
    challengeRequestKeyRef,
    expertVerificationRequestKeyRef,
    game,
    handleProceedFromChallenge: actions.handleProceedFromChallenge,
    handleProceedFromExpertVerification: actions.handleProceedFromExpertVerification,
    handleProceedFromPlatformBonus: actions.handleProceedFromPlatformBonus,
    handleSkipTurn: actions.handleSkipTurn,
    isActivePlayerConnected,
    platformBonusRequestKeyRef,
    secondsRemaining,
    skipRequestKeyRef,
  });

  useGameReconciliation({
    game,
    isSubmittingPlacement,
    setGame,
  });

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
        connectedUserIds={presence.map((p) => p.userId)}
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
        <GameScreenHeader
          actionError={actionError}
          activePlayer={activePlayer}
          disconnectCountdown={disconnectCountdown}
          game={game}
          isTeamworkMode={isTeamworkMode}
          phasePlayer={phasePlayer}
          presenceCount={presence.length}
          secondsRemaining={secondsRemaining}
          showDisconnectNotice={showDisconnectNotice}
          winner={winner}
        />

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
                  void actions.handleTeamVote(position, false);
                }}
                onLockIn={(position) => {
                  void actions.handleTeamVote(position, true);
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
              void actions.handleChallenge();
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
            void actions.handleSubmitPlatformBonus(selectedPlatformIds);
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
            void actions.handleSubmitExpertVerification(yearGuess, selectedPlatformIds);
          }}
          options={game.currentTurn.platformOptions}
          result={expertVerificationResult}
          secondsRemaining={
            game.currentTurn.phase === "expert_verification" ? secondsRemaining : null
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card className="border-border/60 bg-surface-800/70 overflow-visible">
            <CardHeader>
              <CardTitle>Current Card</CardTitle>
              <CardDescription>
                {isTeamworkMode
                  ? "Everyone votes on where this game fits in the shared timeline."
                  : "Everyone can inspect the current screenshot while the active player decides."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GameCard
                coverImageId={game.currentTurn.card.coverImageId}
                isRevealed={game.currentTurn.card.isRevealed}
                platform={game.currentTurn.card.platform}
                releaseYear={game.currentTurn.card.releaseYear ?? 0}
                screenshotImageId={game.currentTurn.card.screenshotImageId}
                title={game.currentTurn.card.title}
              />
            </CardContent>
          </Card>

          <GamePlayerTimelines
            disconnectCountdown={disconnectCountdown}
            disconnectGrace={disconnectGrace}
            game={game}
            isSkippingTurn={isSkippingTurn}
            isSubmittingPlacement={isSubmittingPlacement}
            onPlaceCard={(position: number) => {
              void actions.handlePlaceCard(position);
            }}
            placementFeedback={placementFeedback}
            placingTurnKey={placingTurnKey}
            presence={presence}
          />
        </div>

        {challengeNotice !== null ? (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              challengeNotice.includes("successfully")
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-amber-400/30 bg-amber-500/10 text-amber-100",
            )}
          >
            {challengeNotice}
          </div>
        ) : null}
      </div>
    </div>
  );
}
