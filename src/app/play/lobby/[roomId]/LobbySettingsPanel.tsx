"use client";

import { z } from "zod";
import { LobbySettingsSchema, type LobbySettings } from "@/lib/multiplayer/lobby";
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
  isHost: boolean;
  isSaving: boolean;
  onSettingChange: (patch: Partial<LobbySettings>) => void;
}>;

const DifficultySchema = LobbySettingsSchema.shape.difficulty;
const TurnTimerSchema = LobbySettingsSchema.shape.turnTimer;
const VariantSchema = LobbySettingsSchema.shape.variant;
const TokensEnabledSchema = z.enum(["on", "off"]);

/**
 * Displays lobby game settings. Hosts get editable controls; non-hosts see read-only values.
 */
export function LobbySettingsPanel({
  settings,
  isHost,
  isSaving,
  onSettingChange,
}: LobbySettingsPanelProps) {
  return (
    <Card className="border-border/60 bg-surface-800/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Game Settings
          {!isHost && <span className="text-text-secondary text-sm font-normal">(read-only)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                  <SelectItem value="teamwork">Teamwork</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-text-primary text-sm capitalize">{settings.variant}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
