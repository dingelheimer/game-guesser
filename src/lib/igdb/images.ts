/**
 * IGDB Cloudinary CDN image URL helpers.
 *
 * Images are served directly from IGDB's CDN. Store only the `igdb_image_id`
 * in the database and construct full URLs at runtime using these helpers.
 *
 * URL pattern: https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg
 */

const IGDB_CDN_BASE = "https://images.igdb.com/igdb/image/upload";

export type IgdbImageSize =
  | "cover_small" //   90 × 128
  | "cover_big" //    264 × 374
  | "screenshot_med" //  569 × 320
  | "screenshot_big" //  889 × 500
  | "screenshot_huge" // 1280 × 720
  | "720p" //         1280 × 720 (same as screenshot_huge but distinct template)
  | "1080p" //        1920 × 1080
  | "thumb"; //         90 × 90

/** Build a full IGDB CDN URL for any image size. */
export function igdbImageUrl(imageId: string, size: IgdbImageSize): string {
  return `${IGDB_CDN_BASE}/t_${size}/${imageId}.jpg`;
}

/** Screenshot shown during the guessing phase — desktop. */
export const screenshotUrl = (imageId: string): string =>
  igdbImageUrl(imageId, "screenshot_big");

/** Screenshot shown during the guessing phase — mobile. */
export const screenshotUrlMobile = (imageId: string): string =>
  igdbImageUrl(imageId, "screenshot_med");

/** Cover art revealed after the player places their card. */
export const coverUrl = (imageId: string): string =>
  igdbImageUrl(imageId, "cover_big");

/** Small thumbnail used in the timeline. */
export const thumbnailUrl = (imageId: string): string =>
  igdbImageUrl(imageId, "thumb");
