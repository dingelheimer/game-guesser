// SPDX-License-Identifier: AGPL-3.0-only

export interface TimelineItem {
  id: string;
  screenshotImageId: string | null;
  coverImageId: string | null;
  title: string;
  releaseYear: number;
  platform: string;
  /** True once the card has been placed and revealed on the timeline. */
  isRevealed: boolean;
}

/** Draggable ID for the pending card element. */
export const PENDING_DRAGGABLE_ID = "pending-card";

/** HTML data attribute used for keyboard focus lookup on drop zones. */
export const ZONE_DATA_ATTR = "data-zone-index";

/** Returns the @dnd-kit droppable ID for a drop zone at the given index. */
export function zoneDroppableId(index: number): string {
  return `zone-${String(index)}`;
}

/** Parses a zone index from a droppable ID, or returns null if invalid. */
export function parseZoneIndex(id: string): number | null {
  if (!id.startsWith("zone-")) return null;
  const n = parseInt(id.slice(5), 10);
  return isNaN(n) ? null : n;
}
