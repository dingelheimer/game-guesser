"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createRoom, joinRoom } from "@/lib/multiplayer/actions";
import { getFieldErrors, type FieldErrors } from "@/lib/multiplayer/actionResult";
import { ensureMultiplayerSession } from "@/lib/multiplayer/browser";
import { DisplayNameSchema, RoomCodeSchema } from "@/lib/multiplayer/lobby";

const createRoomFormSchema = z.object({
  displayName: DisplayNameSchema,
});

const joinRoomFormSchema = z.object({
  code: RoomCodeSchema,
  displayName: DisplayNameSchema,
});

type LobbyEntryMode = "create" | "join";

type LobbyEntryDialogProps = Readonly<{
  mode: LobbyEntryMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDisplayName: string | null;
}>;

type LobbyEntryState = Readonly<{
  displayName: string;
  roomCode: string;
  formError: string | null;
  fieldErrors: FieldErrors | undefined;
}>;

function normalizeRoomCodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 6);
}

function buildInitialState(defaultDisplayName: string | null): LobbyEntryState {
  return {
    displayName: defaultDisplayName ?? "",
    roomCode: "",
    formError: null,
    fieldErrors: undefined,
  };
}

/**
 * Modal form used by the /play hub to create or join a multiplayer room.
 */
export function LobbyEntryDialog({
  mode,
  open,
  onOpenChange,
  defaultDisplayName,
}: LobbyEntryDialogProps) {
  const router = useRouter();
  const roomCodeRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<LobbyEntryState>(() => buildInitialState(defaultDisplayName));

  const copy = useMemo(
    () =>
      mode === "create"
        ? {
            title: "Create Room",
            description: "Pick the display name other players will see when they join your lobby.",
            submitLabel: "Create Room",
            pendingLabel: "Creating room…",
            errorMessage: "Please enter a valid display name before creating a room.",
          }
        : {
            title: "Join Room",
            description: "Enter a room code and the display name you want to show in the lobby.",
            submitLabel: "Join Room",
            pendingLabel: "Joining room…",
            errorMessage: "Please provide a valid room code and display name before joining.",
          },
    [mode],
  );

  useEffect(() => {
    if (!open) {
      setIsPending(false);
      setState(buildInitialState(defaultDisplayName));
      return;
    }

    if (mode === "join") {
      roomCodeRef.current?.focus();
      return;
    }

    displayNameRef.current?.focus();
  }, [defaultDisplayName, mode, open]);

  function updateField<K extends keyof LobbyEntryState>(field: K, value: LobbyEntryState[K]): void {
    setState((current) => ({
      ...current,
      [field]: value,
      formError: field === "displayName" || field === "roomCode" ? null : current.formError,
      fieldErrors: undefined,
    }));
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) {
      setIsPending(false);
      setState(buildInitialState(defaultDisplayName));
    }

    onOpenChange(nextOpen);
  }

  async function handleSubmit(): Promise<void> {
    if (mode === "create") {
      const parsed = createRoomFormSchema.safeParse({ displayName: state.displayName });
      if (!parsed.success) {
        setState((current) => ({
          ...current,
          formError: copy.errorMessage,
          fieldErrors: getFieldErrors(parsed.error),
        }));
        return;
      }

      setIsPending(true);
      setState((current) => ({
        ...current,
        formError: null,
        fieldErrors: undefined,
      }));

      const sessionResult = await ensureMultiplayerSession();
      if (!sessionResult.success) {
        setIsPending(false);
        setState((current) => ({
          ...current,
          formError: sessionResult.message,
        }));
        return;
      }

      const result = await createRoom(parsed.data.displayName);
      if (!result.success) {
        setIsPending(false);
        setState((current) => ({
          ...current,
          formError: result.error.message,
          fieldErrors:
            result.error.code === "VALIDATION_ERROR" ? result.error.fieldErrors : undefined,
        }));
        return;
      }

      handleOpenChange(false);
      router.push(`/play/lobby/${result.data.roomId}`);
      return;
    }

    const parsed = joinRoomFormSchema.safeParse({
      code: state.roomCode,
      displayName: state.displayName,
    });
    if (!parsed.success) {
      setState((current) => ({
        ...current,
        formError: copy.errorMessage,
        fieldErrors: getFieldErrors(parsed.error),
      }));
      return;
    }

    setIsPending(true);
    setState((current) => ({
      ...current,
      formError: null,
      fieldErrors: undefined,
    }));

    const sessionResult = await ensureMultiplayerSession();
    if (!sessionResult.success) {
      setIsPending(false);
      setState((current) => ({
        ...current,
        formError: sessionResult.message,
      }));
      return;
    }

    const result = await joinRoom(parsed.data.code, parsed.data.displayName);
    if (!result.success) {
      setIsPending(false);
      setState((current) => ({
        ...current,
        formError: result.error.message,
        fieldErrors:
          result.error.code === "VALIDATION_ERROR" ? result.error.fieldErrors : undefined,
      }));
      return;
    }

    handleOpenChange(false);
    router.push(`/play/lobby/${result.data.roomId}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          {state.formError !== null && (
            <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm" role="alert">
              {state.formError}
            </p>
          )}

          {mode === "join" && (
            <div className="space-y-1.5">
              <label htmlFor="room-code" className="text-text-primary block text-sm font-medium">
                Room code
              </label>
              <Input
                ref={roomCodeRef}
                id="room-code"
                name="roomCode"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                maxLength={6}
                value={state.roomCode}
                aria-invalid={state.fieldErrors?.code !== undefined}
                onChange={(event) => {
                  updateField("roomCode", normalizeRoomCodeInput(event.target.value));
                }}
                className="font-mono text-base tracking-[0.35em] uppercase"
                placeholder="ABCD23"
              />
              {state.fieldErrors?.code?.map((error) => (
                <p key={error} className="text-destructive text-xs">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor={`${mode}-display-name`}
              className="text-text-primary block text-sm font-medium"
            >
              Display name
            </label>
            <Input
              ref={displayNameRef}
              id={`${mode}-display-name`}
              name="displayName"
              type="text"
              autoComplete="nickname"
              maxLength={20}
              value={state.displayName}
              aria-invalid={state.fieldErrors?.displayName !== undefined}
              onChange={(event) => {
                updateField("displayName", event.target.value);
              }}
              placeholder="Player One"
            />
            <p className="text-text-secondary text-xs">
              2-20 characters. Letters, numbers, spaces, and underscores only.
            </p>
            {state.fieldErrors?.displayName?.map((error) => (
              <p key={error} className="text-destructive text-xs">
                {error}
              </p>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.pendingLabel}
                </>
              ) : (
                copy.submitLabel
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
