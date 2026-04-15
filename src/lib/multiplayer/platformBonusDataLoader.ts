// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";

import {
  buildPlatformOptions,
  getPlatformDisplayName,
  maxDistractorsNeeded,
  type PlatformOption,
} from "@/lib/platformBonus";
import { appError, fail, ok, type AppError, type Result } from "./actionResult";
import {
  PlatformIdRowSchema,
  PlatformRowSchema,
  type PlatformBonusState,
  type ServiceClient,
} from "./gameActionTypes";

/** Load the correct platform IDs and build distractor options for platform bonus. */
export async function loadPlatformBonusState(
  serviceClient: ServiceClient,
  gameId: number,
  releaseYear?: number,
): Promise<Result<PlatformBonusState, AppError>> {
  const { data: correctPlatformRows, error: correctPlatformError } = await serviceClient
    .from("game_platforms")
    .select("platform_id")
    .eq("game_id", gameId);

  if (correctPlatformError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the correct platform bonus answers."));
  }

  const safeCorrectPlatformRows = Array.isArray(correctPlatformRows) ? correctPlatformRows : [];
  const correctPlatformIds = safeCorrectPlatformRows.flatMap((row) => {
    const parsedRow = PlatformIdRowSchema.safeParse(row);
    return parsedRow.success ? [parsedRow.data.platform_id] : [];
  });
  const uniqueCorrectPlatformIds = [...new Set(correctPlatformIds)];
  if (uniqueCorrectPlatformIds.length !== safeCorrectPlatformRows.length) {
    const allRowsParsed = safeCorrectPlatformRows.every(
      (row) => PlatformIdRowSchema.safeParse(row).success,
    );
    if (!allRowsParsed) {
      return fail(
        appError("INTERNAL_ERROR", "Encountered an invalid platform bonus answer payload."),
      );
    }
  }

  const { data: correctPlatformsRows, error: correctPlatformsError } =
    uniqueCorrectPlatformIds.length === 0
      ? { data: [], error: null }
      : await serviceClient.from("platforms").select("id, name").in("id", uniqueCorrectPlatformIds);

  if (correctPlatformsError !== null) {
    return fail(appError("INTERNAL_ERROR", "Failed to load the correct platform bonus labels."));
  }

  const correctPlatformById = new Map<number, PlatformOption>();
  const safeCorrectPlatformsRows = Array.isArray(correctPlatformsRows) ? correctPlatformsRows : [];
  for (const row of safeCorrectPlatformsRows) {
    const parsedRow = PlatformRowSchema.safeParse(row);
    if (!parsedRow.success) {
      return fail(appError("INTERNAL_ERROR", "Encountered an invalid platform bonus label."));
    }

    correctPlatformById.set(parsedRow.data.id, {
      id: parsedRow.data.id,
      name: getPlatformDisplayName(parsedRow.data.name),
    });
  }

  const correctPlatforms = uniqueCorrectPlatformIds.flatMap((platformId) => {
    const platform = correctPlatformById.get(platformId);
    return platform === undefined ? [] : [platform];
  });
  if (releaseYear === undefined) {
    return ok({
      correctIds: uniqueCorrectPlatformIds,
      correctPlatforms,
      options: correctPlatforms,
    });
  }

  const distractorsNeeded = maxDistractorsNeeded(correctPlatforms.length);

  const fetchDistractors = async (halfRange: number): Promise<readonly PlatformOption[]> => {
    if (distractorsNeeded === 0) {
      return [];
    }

    const { data: eraGames, error: eraGamesError } = await serviceClient
      .from("games")
      .select("id")
      .gte("release_year", releaseYear - halfRange)
      .lte("release_year", releaseYear + halfRange)
      .neq("id", gameId);

    const safeEraGames = Array.isArray(eraGames) ? eraGames : [];
    if (eraGamesError !== null || safeEraGames.length === 0) {
      return [];
    }

    const eraGameIds = safeEraGames.flatMap((row) => (typeof row.id === "number" ? [row.id] : []));
    if (eraGameIds.length === 0) {
      return [];
    }

    const { data: candidateRows, error: candidateError } = await serviceClient
      .from("game_platforms")
      .select("platform_id")
      .in("game_id", eraGameIds);

    const safeCandidateRows = Array.isArray(candidateRows) ? candidateRows : [];
    if (candidateError !== null || safeCandidateRows.length === 0) {
      return [];
    }

    const candidatePlatformIds = safeCandidateRows.flatMap((row) => {
      const parsedRow = PlatformIdRowSchema.safeParse(row);
      return parsedRow.success ? [parsedRow.data.platform_id] : [];
    });
    const uniqueCandidateIds = [...new Set(candidatePlatformIds)].filter(
      (platformId) => !uniqueCorrectPlatformIds.includes(platformId),
    );

    if (uniqueCandidateIds.length === 0) {
      return [];
    }

    for (let index = uniqueCandidateIds.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = uniqueCandidateIds[index];
      const swap = uniqueCandidateIds[swapIndex];
      if (current !== undefined && swap !== undefined) {
        uniqueCandidateIds[index] = swap;
        uniqueCandidateIds[swapIndex] = current;
      }
    }

    const selectedIds = uniqueCandidateIds.slice(0, distractorsNeeded);
    const { data: platformRows, error: platformError } = await serviceClient
      .from("platforms")
      .select("id, name")
      .in("id", selectedIds);

    if (platformError !== null) {
      return [];
    }

    const platformById = new Map<number, PlatformOption>();
    const safePlatformRows = Array.isArray(platformRows) ? platformRows : [];
    for (const row of safePlatformRows) {
      const parsedRow = PlatformRowSchema.safeParse(row);
      if (parsedRow.success) {
        platformById.set(parsedRow.data.id, {
          id: parsedRow.data.id,
          name: getPlatformDisplayName(parsedRow.data.name),
        });
      }
    }

    return selectedIds.flatMap((platformId) => {
      const platform = platformById.get(platformId);
      return platform === undefined ? [] : [platform];
    });
  };

  let distractors = await fetchDistractors(5);
  const minimumDistractors = Math.max(0, 8 - correctPlatforms.length);
  if (distractors.length < minimumDistractors) {
    distractors = await fetchDistractors(15);
  }

  const optionsResult = buildPlatformOptions(correctPlatforms, distractors);
  return ok({
    correctIds: optionsResult.correctIds,
    correctPlatforms,
    options: optionsResult.options,
  });
}
