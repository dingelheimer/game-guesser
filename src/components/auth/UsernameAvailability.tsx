"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "checking" | "available" | "taken";

export function UsernameAvailability({ username }: { username: string }) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (username.length < 3) {
      setStatus("idle");
      return;
    }

    const timeout = setTimeout(() => {
      setStatus("checking");
      const supabase = createClient();
      void supabase
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .maybeSingle()
        .then(({ data }) => {
          setStatus(data !== null ? "taken" : "available");
        });
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [username]);

  if (status === "idle") return null;

  if (status === "checking") {
    return (
      <span className="text-text-secondary flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking availability…
      </span>
    );
  }

  if (status === "available") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Username available
      </span>
    );
  }

  return (
    <span className="text-destructive flex items-center gap-1 text-xs">
      <XCircle className="h-3 w-3" />
      Username already taken
    </span>
  );
}
