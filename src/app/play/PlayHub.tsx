// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Gamepad2, PlusCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LobbyEntryDialog } from "./LobbyEntryDialog";
import { NextChallengeCountdown } from "@/components/daily/NextChallengeCountdown";
import type { DailyChallengeStatus } from "@/lib/daily/status.server";

// ── Daily challenge card ──────────────────────────────────────────────────────

interface DailyChallengeCardProps {
  status: DailyChallengeStatus;
}

function DailyChallengeCard({ status }: DailyChallengeCardProps) {
  if (status.state === "no_challenge") return null;

  const challengeLabel =
    status.state === "guest_cta"
      ? "Daily Challenge"
      : `Daily Challenge #${String(status.challengeNumber)}`;

  const streakText =
    status.state === "completed" && status.currentStreak !== null && status.currentStreak > 0
      ? ` 🔥 ${String(status.currentStreak)}-day streak`
      : null;

  const descriptionText =
    status.state === "completed"
      ? `Score: ${String(status.score)}/${String(status.totalCards)}${streakText ?? ""}`
      : status.state === "in_progress"
        ? "You have a game in progress — pick up where you left off."
        : "Place 10 games on the timeline. Same puzzle for everyone.";

  const ctaLabel =
    status.state === "completed"
      ? "View Result"
      : status.state === "in_progress"
        ? "Continue"
        : status.state === "guest_cta"
          ? "Play Free"
          : "Play Today";

  return (
    <>
      <Card className="relative overflow-hidden border-sky-500/30 bg-sky-500/5">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(14,165,233,0.12),_transparent_60%)]" />
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-6 w-6 text-sky-400" aria-hidden="true" />
                <CardTitle className="text-sky-100">{challengeLabel}</CardTitle>
              </div>
              <CardDescription>{descriptionText}</CardDescription>
            </div>
            {status.state === "completed" && (
              <div className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
                ✅ Done
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            asChild
            className="w-full sm:w-auto"
            variant={status.state === "completed" ? "outline" : "default"}
          >
            <Link href="/daily">{ctaLabel}</Link>
          </Button>
          {status.state === "completed" && <NextChallengeCountdown />}
        </CardContent>
      </Card>

      <div className="relative flex items-center">
        <div className="border-border/40 flex-1 border-t" />
        <span className="text-text-secondary bg-transparent px-3 text-xs font-semibold tracking-[0.15em] uppercase">
          Other Modes
        </span>
        <div className="border-border/40 flex-1 border-t" />
      </div>
    </>
  );
}

// ── PlayHub ───────────────────────────────────────────────────────────────────

/** Props for the client-side play hub. */
export type PlayHubProps = Readonly<{
  defaultDisplayName: string | null;
  /** Daily challenge status fetched server-side. Omit to hide the daily card. */
  dailyChallengeStatus?: DailyChallengeStatus;
}>;

/**
 * Client-side play hub for solo and multiplayer entry flows.
 */
export function PlayHub({ defaultDisplayName, dailyChallengeStatus }: PlayHubProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  return (
    <>
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full max-w-5xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="font-display text-text-primary text-4xl font-bold tracking-tight sm:text-5xl">
              Choose your next game
            </h1>
            <p className="text-text-secondary mx-auto max-w-2xl text-sm sm:text-base">
              Jump into a solo run, host a multiplayer lobby, or join friends with a room code.
            </p>
          </div>

          {dailyChallengeStatus !== undefined && (
            <DailyChallengeCard status={dailyChallengeStatus} />
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-surface-800/70">
              <CardHeader>
                <Gamepad2 className="text-primary-400 h-8 w-8" />
                <CardTitle>Solo Endless</CardTitle>
                <CardDescription>
                  Keep building your timeline and chase a higher streak on your own.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/play/solo">Solo Endless</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-surface-800/70">
              <CardHeader>
                <PlusCircle className="text-primary-400 h-8 w-8" />
                <CardTitle>Create Room</CardTitle>
                <CardDescription>
                  Start a new lobby, share the room code, and get everyone ready to play.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => {
                    setIsCreateOpen(true);
                  }}
                >
                  Create Room
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-surface-800/70">
              <CardHeader>
                <Users className="text-primary-400 h-8 w-8" />
                <CardTitle>Join Room</CardTitle>
                <CardDescription>
                  Enter a six-character code and jump straight into an existing lobby.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsJoinOpen(true);
                  }}
                >
                  Join Room
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-text-secondary text-center text-sm">
            Guests can create or join multiplayer rooms instantly. Log in when you want to save solo
            scores to the leaderboard.
          </p>
        </div>
      </div>

      <LobbyEntryDialog
        mode="create"
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultDisplayName={defaultDisplayName}
      />
      <LobbyEntryDialog
        mode="join"
        open={isJoinOpen}
        onOpenChange={setIsJoinOpen}
        defaultDisplayName={defaultDisplayName}
      />
    </>
  );
}
