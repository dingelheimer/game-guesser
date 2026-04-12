/**
 * Sort multiplayer players into final standings order.
 * Higher scores rank first; ties are broken by earlier turn position.
 */
export function sortPlayersByStanding<T extends { score: number; turnPosition: number }>(
  players: readonly T[],
): T[] {
  return [...players].sort(
    (left, right) => right.score - left.score || left.turnPosition - right.turnPosition,
  );
}
