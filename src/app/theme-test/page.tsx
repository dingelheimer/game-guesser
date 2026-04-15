// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { CheckCircle, Gamepad2, Moon, Sun, Trophy, XCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function ThemeTestPage() {
  const { setTheme, theme } = useTheme();

  return (
    <div className="bg-background text-foreground min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="font-display text-5xl font-bold tracking-tight">
            <span className="text-primary">Game</span> <span className="text-accent">Guesser</span>
          </h1>
          <p className="text-text-secondary font-sans">
            Neon Arcade Design System — Theme Test Page
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
              }}
            >
              <Sun className="size-4 scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute size-4 scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
            </Button>
            <span className="text-muted-foreground text-sm">Toggle theme</span>
          </div>
        </header>

        {/* Typography */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Typography</h2>
          <div className="bg-card space-y-2 rounded-xl p-6">
            <p className="font-display text-3xl font-bold">Space Grotesk — Display / Headings</p>
            <p className="font-sans text-lg">Inter — Body text for UI and descriptions</p>
            <p className="font-mono text-sm tabular-nums">
              JetBrains Mono — 1998 2004 2011 2017 (Years & Scores)
            </p>
          </div>
        </section>

        {/* Color Palette */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Color Palette</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ColorSwatch name="surface-900" className="bg-surface-900" />
            <ColorSwatch name="surface-800" className="bg-surface-800" />
            <ColorSwatch name="surface-700" className="bg-surface-700" />
            <ColorSwatch name="surface-600" className="bg-surface-600" />
            <ColorSwatch name="primary-400" className="bg-primary-400" />
            <ColorSwatch name="primary-500" className="bg-primary-500" />
            <ColorSwatch name="primary-600" className="bg-primary-600" />
            <ColorSwatch name="accent-400" className="bg-accent-400" />
            <ColorSwatch name="accent-500" className="bg-accent-500" />
            <ColorSwatch name="correct" className="bg-correct" />
            <ColorSwatch name="incorrect" className="bg-incorrect" />
            <ColorSwatch name="close" className="bg-close" />
            <ColorSwatch name="challenge" className="bg-challenge" />
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button size="lg">
              <Gamepad2 className="size-4" />
              Play Now
            </Button>
          </div>
          {/* Glowing CTA */}
          <Button className="bg-primary-500 hover:bg-primary-600 px-8 py-3 font-bold shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all duration-200 hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] active:scale-95">
            <Gamepad2 className="size-5" />
            Start Game
          </Button>
        </section>

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge className="bg-correct text-white">
              <CheckCircle className="size-3" /> Correct
            </Badge>
            <Badge className="bg-incorrect text-white">
              <XCircle className="size-3" /> Incorrect
            </Badge>
            <Badge className="bg-close text-white">~ Close</Badge>
            <Badge className="bg-challenge text-white">
              <Trophy className="size-3" /> Challenge
            </Badge>
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Cards</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Half-Life 2</CardTitle>
                <CardDescription>First-person shooter by Valve</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-primary-400 font-mono text-2xl tabular-nums">2004</span>
              </CardContent>
            </Card>
            {/* Glass-morphism card */}
            <div className="bg-surface-800/80 rounded-2xl border border-white/10 p-6 shadow-xl backdrop-blur-xl">
              <h3 className="font-display text-text-primary text-lg font-semibold">Glass Panel</h3>
              <p className="text-text-secondary mt-2 text-sm">
                Frosted glass morphism with backdrop blur and subtle border.
              </p>
            </div>
          </div>
        </section>

        {/* Input & Select */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Inputs & Select</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input placeholder="Guess the game title..." className="max-w-xs" />
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Progress */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Progress</h2>
          <Progress value={66} className="w-full" />
          <p className="text-muted-foreground text-sm">Round 7 of 10</p>
        </section>

        {/* Tabs */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Tabs</h2>
          <Tabs defaultValue="game">
            <TabsList>
              <TabsTrigger value="game">Game</TabsTrigger>
              <TabsTrigger value="scores">Scores</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="game" className="mt-3 text-sm">
              Game board content here.
            </TabsContent>
            <TabsContent value="scores" className="mt-3 text-sm">
              Leaderboard and scores.
            </TabsContent>
            <TabsContent value="settings" className="mt-3 text-sm">
              Game settings panel.
            </TabsContent>
          </Tabs>
        </section>

        {/* Tooltip */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Tooltip</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Place this card on the timeline</p>
            </TooltipContent>
          </Tooltip>
        </section>

        {/* Dialog */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Dialog</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Game Over Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Game Over!</DialogTitle>
                <DialogDescription>
                  You placed <span className="text-primary-400 font-mono tabular-nums">8</span>{" "}
                  cards correctly. New high score!
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 pt-4">
                <Button className="flex-1">Play Again</Button>
                <Button variant="outline" className="flex-1">
                  Leaderboard
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        {/* Sheet */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Sheet</h2>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open Player List</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="font-display">Players (3/8)</SheetTitle>
                <SheetDescription>Players in the current lobby.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                <PlayerChip name="Player 1" tag="Host" />
                <PlayerChip name="Player 2" />
                <PlayerChip name="Player 3" />
              </div>
            </SheetContent>
          </Sheet>
        </section>

        {/* Toast */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Toast (Sonner)</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                toast.success("Correct placement!", {
                  description: "Half-Life 2 → 2004",
                });
              }}
            >
              Success Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.error("Wrong position!", {
                  description: "Try again next round.",
                });
              }}
            >
              Error Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("Player 2 challenged your placement!");
              }}
            >
              Info Toast
            </Button>
          </div>
        </section>

        {/* ScrollArea */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Scroll Area</h2>
          <ScrollArea className="bg-card h-48 w-full rounded-xl border p-4">
            <div className="space-y-3">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className="bg-surface-700 flex items-center justify-between rounded-lg px-4 py-2"
                >
                  <span className="text-sm">
                    #{i + 1} — Game Title {i + 1}
                  </span>
                  <span className="text-text-secondary font-mono text-xs tabular-nums">
                    {1990 + i}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </section>

        {/* Skeleton */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Skeleton Loading</h2>
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </section>

        {/* Game-state demo */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Game State Indicators</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-card ring-correct rounded-xl p-4 shadow-[0_0_20px_rgba(34,197,94,0.4)] ring-2">
              <p className="font-display text-correct font-semibold">✓ Correct Placement</p>
              <p className="text-text-secondary text-sm">Card is in the right position</p>
            </div>
            <div className="bg-card ring-incorrect rounded-xl p-4 shadow-[0_0_20px_rgba(239,68,68,0.4)] ring-2">
              <p className="font-display text-incorrect font-semibold">✗ Incorrect Placement</p>
              <p className="text-text-secondary text-sm">Card is in the wrong position</p>
            </div>
            <div className="bg-card ring-close rounded-xl p-4 shadow-[0_0_20px_rgba(234,179,8,0.4)] ring-2">
              <p className="font-display text-close font-semibold">~ Close (within ±2 years)</p>
              <p className="text-text-secondary text-sm">Almost there!</p>
            </div>
            <div className="bg-card ring-challenge rounded-xl p-4 shadow-[0_0_20px_rgba(249,115,22,0.4)] ring-2">
              <p className="font-display text-challenge font-semibold">⚡ Challenge Active</p>
              <p className="text-text-secondary text-sm">Another player is challenging</p>
            </div>
          </div>
        </section>

        {/* Timeline year marker */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Timeline Year Marker</h2>
          <div className="flex items-end gap-1">
            {[1998, 2001, 2004, 2007, 2011, 2015, 2020].map((year) => (
              <div key={year} className="flex flex-col items-center">
                <div className="bg-surface-600 h-4 w-0.5" />
                <span className="bg-surface-800 text-text-secondary rounded px-2 py-0.5 font-mono text-xs tabular-nums">
                  {year}
                </span>
                <div className="bg-surface-600 h-4 w-0.5" />
              </div>
            ))}
          </div>
        </section>

        <footer className="border-border text-text-secondary border-t py-6 text-center text-sm">
          Game data provided by IGDB / Twitch — Theme test page (temporary)
        </footer>
      </div>
    </div>
  );
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="space-y-1">
      <div className={`h-12 rounded-lg border border-white/10 ${className}`} />
      <p className="text-text-secondary text-xs">{name}</p>
    </div>
  );
}

function PlayerChip({ name, tag }: { name: string; tag?: string }) {
  return (
    <div className="bg-surface-700 flex items-center gap-3 rounded-full px-4 py-2">
      <div className="from-primary-400 to-accent-400 size-8 rounded-full bg-gradient-to-br" />
      <span className="text-text-primary font-medium">{name}</span>
      {tag != null && (
        <span className="bg-surface-600 ml-auto rounded-full px-2 py-0.5 text-xs">{tag}</span>
      )}
    </div>
  );
}
