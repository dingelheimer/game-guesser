// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Build a stable multiplayer platform label from a game's platform names.
 */
export function buildPlatformLabel(names: readonly string[]): string {
  const primaryPlatform = [...names].sort((left, right) => left.localeCompare(right))[0];
  return primaryPlatform ?? "Unknown";
}
