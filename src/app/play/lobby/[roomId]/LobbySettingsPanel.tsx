"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { z } from "zod";
import { LobbySettingsSchema, type LobbyGenre, type LobbySettings } from "@/lib/multiplayer/lobby";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Props for the {@link LobbySettingsPanel} component.
 */
export type LobbySettingsPanelProps = Readonly<{
  settings: LobbySettings;
  genres: readonly LobbyGenre[];
  isHost: boolean;
  isSaving: boolean;
  onSettingChange: (patch: Partial<LobbySettings>) => void;
}>;

const DifficultySchema = LobbySettingsSchema.shape.difficulty;
const TurnTimerSchema = LobbySettingsSchema.shape.turnTimer;
const VariantSchema = LobbySettingsSchema.shape.variant;
const GameModeSchema = LobbySettingsSchema.shape.gameMode;
const TokensEnabledSchema = z.enum(["on", "off"]);

/** Platform families available for the console lock house rule. */
const PLATFORM_FAMILIES = [
  { value: "nintendo", label: "Nintendo" },
  { value: "playstation", label: "PlayStation" },
  { value: "xbox", label: "Xbox" },
  { value: "pc", label: "PC" },
  { value: "sega", label: "Sega" },
] as const;

/** Decade options for the decade mode house rule (1980s–2020s). */
const DECADE_OPTIONS = [
  { value: 1980, label: "1980s" },
  { value: 1990, label: "1990s" },
  { value: 2000, label: "2000s" },
  { value: 2010, label: "2010s" },
  { value: 2020, label: "2020s" },
] as const;

/**
 * Displays lobby game settings. Hosts get editable controls; non-hosts see read-only values.
 */
export function LobbySettingsPanel({
  settings,
  genres,
  isHost,
  isSaving,
  onSettingChange,
}: LobbySettingsPanelProps) {
  const [houseRulesOpen, setHouseRulesOpen] = useState(false);

  const isTeamwork = settings.gameMode === "teamwork";

  return (
    <Card className="border-border/60 bg-surface-800/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Game Settings
          {!isHost && <span className="text-text-secondary text-sm font-normal">(read-only)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Core settings grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Game Mode */}
          <div className="space-y-1.5">
            <label className="text-text-secondary text-xs font-medium">Game Mode</label>
            {isHost ? (
              <Select
                disabled={isSaving}
                value={settings.gameMode}
                onValueChange={(val) => {
                  const parsed = GameModeSchema.safeParse(val);
                  if (parsed.success) onSettingChange({ gameMode: parsed.data });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competitive">Competitive</SelectItem>
                  <SelectItem value="teamwork">Teamwork (Co-op)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-text-primary text-sm capitalize">{settings.gameMode}</p>
            )}
          </div>

          {/* Variant — hidden in teamwork mode */}
          {!isTeamwork && (
            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs font-medium">Variant</label>
              {isHost ? (
                <Select
                  disabled={isSaving}
                  value={settings.variant}
                  onValueChange={(val) => {
                    const parsed = VariantSchema.safeParse(val);
                    if (parsed.success) onSettingChange({ variant: parsed.data });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="pro">PRO</SelectItem>
                    <SelectItem value="expert">EXPERT</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-text-primary text-sm uppercase">{settings.variant}</p>
              )}
            </div>
          )}

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-text-secondary text-xs font-medium">Difficulty</label>
            {isHost ? (
              <Select
                disabled={isSaving}
                value={settings.difficulty}
                onValueChange={(val) => {
                  const parsed = DifficultySchema.safeParse(val);
                  if (parsed.success) onSettingChange({ difficulty: parsed.data });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="extreme">Extreme</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-text-primary text-sm capitalize">{settings.difficulty}</p>
            )}
          </div>

          {/* Turn Timer */}
          <div className="space-y-1.5">
            <label className="text-text-secondary text-xs font-medium">Turn Timer</label>
            {isHost ? (
              <Select
                disabled={isSaving}
                value={settings.turnTimer}
                onValueChange={(val) => {
                  const parsed = TurnTimerSchema.safeParse(val);
                  if (parsed.success) onSettingChange({ turnTimer: parsed.data });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-text-primary text-sm">
                {settings.turnTimer === "unlimited" ? "Unlimited" : `${settings.turnTimer}s`}
              </p>
            )}
          </div>

          {/* Tokens */}
          <div className="space-y-1.5">
            <label className="text-text-secondary text-xs font-medium">Tokens</label>
            {isHost ? (
              <Select
                disabled={isSaving}
                value={settings.tokensEnabled ? "on" : "off"}
                onValueChange={(val) => {
                  const parsed = TokensEnabledSchema.safeParse(val);
                  if (parsed.success) onSettingChange({ tokensEnabled: parsed.data === "on" });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Enabled</SelectItem>
                  <SelectItem value="off">Disabled</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-text-primary text-sm">
                {settings.tokensEnabled ? "Enabled" : "Disabled"}
              </p>
            )}
          </div>

          {settings.tokensEnabled && (
            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs font-medium">Starting Tokens</label>
              {isHost ? (
                <Input
                  type="number"
                  disabled={isSaving}
                  min={0}
                  max={10}
                  value={settings.startingTokens}
                  onChange={(e) => {
                    onSettingChange({ startingTokens: Number(e.target.value) });
                  }}
                  className="w-full"
                />
              ) : (
                <p className="text-text-primary text-sm">{String(settings.startingTokens)}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-text-secondary text-xs font-medium">
              Win Condition (points)
            </label>
            {isHost ? (
              <Input
                type="number"
                disabled={isSaving}
                min={5}
                max={20}
                value={settings.winCondition}
                onChange={(e) => {
                  onSettingChange({ winCondition: Number(e.target.value) });
                }}
                className="w-full"
              />
            ) : (
              <p className="text-text-primary text-sm">{String(settings.winCondition)}</p>
            )}
          </div>
        </div>

        {/* House Rules collapsible panel */}
        <div className="border-border/40 border-t pt-4">
          {isHost ? (
            <Button
              type="button"
              variant="ghost"
              className="text-text-secondary hover:text-text-primary -mx-2 flex w-full items-center justify-between px-2 text-sm font-medium"
              onClick={() => {
                setHouseRulesOpen((prev) => !prev);
              }}
            >
              House Rules
              {houseRulesOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <p className="text-text-secondary text-xs font-medium">House Rules</p>
          )}

          {(houseRulesOpen || !isHost) && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Genre Lock */}
              <div className="space-y-1.5">
                <label className="text-text-secondary text-xs font-medium">Genre Lock</label>
                {isHost ? (
                  <Select
                    disabled={isSaving}
                    value={settings.genreLockId !== null ? String(settings.genreLockId) : "none"}
                    onValueChange={(val) => {
                      onSettingChange({
                        genreLockId: val === "none" ? null : Number(val),
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Any genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any genre</SelectItem>
                      {genres.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-text-primary text-sm">
                    {settings.genreLockId !== null
                      ? (genres.find((g) => g.id === settings.genreLockId)?.name ?? "Unknown")
                      : "Any genre"}
                  </p>
                )}
              </div>

              {/* Console Lock */}
              <div className="space-y-1.5">
                <label className="text-text-secondary text-xs font-medium">Console Lock</label>
                {isHost ? (
                  <Select
                    disabled={isSaving}
                    value={settings.consoleLockFamily ?? "none"}
                    onValueChange={(val) => {
                      onSettingChange({ consoleLockFamily: val === "none" ? null : val });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Any platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any platform</SelectItem>
                      {PLATFORM_FAMILIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-text-primary text-sm capitalize">
                    {settings.consoleLockFamily !== null
                      ? (PLATFORM_FAMILIES.find((f) => f.value === settings.consoleLockFamily)
                          ?.label ?? settings.consoleLockFamily)
                      : "Any platform"}
                  </p>
                )}
              </div>

              {/* Decade Mode */}
              <div className="space-y-1.5">
                <label className="text-text-secondary text-xs font-medium">Decade Mode</label>
                {isHost ? (
                  <Select
                    disabled={isSaving}
                    value={settings.decadeStart !== null ? String(settings.decadeStart) : "none"}
                    onValueChange={(val) => {
                      onSettingChange({ decadeStart: val === "none" ? null : Number(val) });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Any decade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any decade</SelectItem>
                      {DECADE_OPTIONS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-text-primary text-sm">
                    {settings.decadeStart !== null
                      ? (DECADE_OPTIONS.find((d) => d.value === settings.decadeStart)?.label ??
                        `${String(settings.decadeStart)}s`)
                      : "Any decade"}
                  </p>
                )}
              </div>

              {/* Speed Round */}
              <div className="space-y-1.5">
                <label className="text-text-secondary text-xs font-medium">Speed Round</label>
                {isHost ? (
                  <Select
                    disabled={isSaving}
                    value={settings.speedRound ? "on" : "off"}
                    onValueChange={(val) => {
                      onSettingChange({ speedRound: val === "on" });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="on">On (10s timer override)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-text-primary text-sm">{settings.speedRound ? "On" : "Off"}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
