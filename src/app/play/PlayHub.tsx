"use client";

import { useState } from "react";
import Link from "next/link";
import { Gamepad2, PlusCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LobbyEntryDialog } from "./LobbyEntryDialog";

/** Props for the client-side play hub. */
export type PlayHubProps = Readonly<{
  defaultDisplayName: string | null;
}>;

/**
 * Client-side play hub for solo and multiplayer entry flows.
 */
export function PlayHub({ defaultDisplayName }: PlayHubProps) {
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
