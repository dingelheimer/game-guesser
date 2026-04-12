import { z } from "zod";

/**
 * Shared platform option shape used by solo and multiplayer platform bonus flows.
 */
export const PlatformOptionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

/**
 * Platform option shown in the platform bonus chip grid.
 */
export type PlatformOption = z.infer<typeof PlatformOptionSchema>;

/** Minimum total platform options shown to the player. */
export const MIN_PLATFORM_OPTIONS = 8;

/** Maximum total options when the game has fewer than the minimum correct platforms. */
export const MAX_PLATFORM_OPTIONS = 12;

/** Maximum total options when the game already has many correct platforms. */
export const MAX_MANY_PLATFORM_OPTIONS = 14;

const MAX_EXTRA_DISTRACTORS = 4;

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  "PC (Microsoft Windows)": "PC",
  Mac: "Mac",
  Linux: "Linux",
  "Web browser": "Browser",
  PlayStation: "PS1",
  "PlayStation 2": "PS2",
  "PlayStation 3": "PS3",
  "PlayStation 4": "PS4",
  "PlayStation 5": "PS5",
  "PlayStation Portable": "PSP",
  "PlayStation Vita": "PS Vita",
  Xbox: "Xbox",
  "Xbox 360": "Xbox 360",
  "Xbox One": "Xbox One",
  "Xbox Series X|S": "Xbox Series X/S",
  "Nintendo Entertainment System": "NES",
  "Super Nintendo Entertainment System": "SNES",
  "Nintendo 64": "N64",
  GameCube: "GameCube",
  Wii: "Wii",
  "Wii U": "Wii U",
  "Nintendo Switch": "Switch",
  "Game Boy": "Game Boy",
  "Game Boy Color": "GBC",
  "Game Boy Advance": "GBA",
  "Nintendo DS": "DS",
  "Nintendo 3DS": "3DS",
  "Virtual Boy": "Virtual Boy",
  "Sega Master System/Mark III": "Sega Master System",
  "Sega Mega Drive/Genesis": "Sega Genesis",
  "Sega 32X": "Sega 32X",
  "Sega CD": "Sega CD",
  "Sega Saturn": "Saturn",
  Dreamcast: "Dreamcast",
  "Sega Game Gear": "Game Gear",
  "Atari 2600": "Atari 2600",
  "Atari 5200": "Atari 5200",
  "Atari 7800": "Atari 7800",
  "Atari Jaguar": "Jaguar",
  "Atari Lynx": "Lynx",
  iOS: "iOS",
  Android: "Android",
  "Windows Phone": "Windows Phone",
};

/**
 * Normalize verbose IGDB platform names for UI display.
 */
export function getPlatformDisplayName(platformName: string): string {
  return PLATFORM_DISPLAY_NAMES[platformName] ?? platformName;
}

/**
 * Return the maximum distractor count required for the supplied number of correct platforms.
 */
export function maxDistractorsNeeded(correctCount: number): number {
  if (correctCount >= MIN_PLATFORM_OPTIONS) {
    return Math.max(0, Math.min(MAX_EXTRA_DISTRACTORS, MAX_MANY_PLATFORM_OPTIONS - correctCount));
  }

  return Math.max(0, MAX_PLATFORM_OPTIONS - correctCount);
}

/**
 * Combine correct and distractor platforms into a shuffled option set.
 */
export function buildPlatformOptions(
  correct: readonly PlatformOption[],
  distractors: readonly PlatformOption[],
  rng: () => number = Math.random,
): Readonly<{
  correctIds: readonly number[];
  options: readonly PlatformOption[];
}> {
  const correctIds = correct.map((platform) => platform.id);
  const selectedDistractors = [...distractors].slice(0, maxDistractorsNeeded(correct.length));
  return {
    correctIds,
    options: shufflePlatformOptions([...correct, ...selectedDistractors], rng),
  };
}

/**
 * Compare selected platform ids against the exact correct set.
 */
export function checkPlatformGuess(
  selectedPlatformIds: readonly number[],
  correctPlatformIds: readonly number[],
): "correct" | "incorrect" {
  if (selectedPlatformIds.length !== correctPlatformIds.length) {
    return "incorrect";
  }

  const sortedSelected = [...selectedPlatformIds].sort((left, right) => left - right);
  const sortedCorrect = [...correctPlatformIds].sort((left, right) => left - right);

  return sortedSelected.every((platformId, index) => platformId === sortedCorrect[index])
    ? "correct"
    : "incorrect";
}

function shufflePlatformOptions(
  options: PlatformOption[],
  rng: () => number,
): readonly PlatformOption[] {
  const shuffled = [...options];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = shuffled[index];
    const swap = shuffled[swapIndex];

    if (current !== undefined && swap !== undefined) {
      shuffled[index] = swap;
      shuffled[swapIndex] = current;
    }
  }

  return shuffled;
}
