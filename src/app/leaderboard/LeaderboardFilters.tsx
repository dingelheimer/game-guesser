// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DIFFICULTY_OPTIONS = [
  { value: "all", label: "All difficulties" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "extreme", label: "Extreme" },
  { value: "god_gamer", label: "God Gamer" },
] as const;

const VARIANT_OPTIONS = [
  { value: "all", label: "All variants" },
  { value: "standard", label: "Standard" },
  { value: "higher_lower", label: "Higher Lower" },
  { value: "pro", label: "PRO" },
  { value: "expert", label: "EXPERT" },
] as const;

interface LeaderboardFiltersProps {
  currentDifficulty: string | null;
  currentVariant: string | null;
}

/** Filter bar for leaderboard — navigates via URL search params. */
export function LeaderboardFilters({ currentDifficulty, currentVariant }: LeaderboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={currentDifficulty ?? "all"}
        onValueChange={(v) => {
          navigate("difficulty", v);
        }}
      >
        <SelectTrigger className="w-[180px]" aria-label="Filter by difficulty">
          <SelectValue placeholder="All difficulties" />
        </SelectTrigger>
        <SelectContent>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentVariant ?? "all"}
        onValueChange={(v) => {
          navigate("variant", v);
        }}
      >
        <SelectTrigger className="w-[180px]" aria-label="Filter by variant">
          <SelectValue placeholder="All variants" />
        </SelectTrigger>
        <SelectContent>
          {VARIANT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
