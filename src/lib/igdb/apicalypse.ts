/**
 * Apicalypse query builder.
 *
 * Apicalypse is IGDB's custom SQL-like DSL sent as the POST body.
 * Reference: https://api-docs.igdb.com/#apicalypse
 */

export interface ApicalypseQuery {
  /**
   * Fields to return. Use `*` for all, or a comma-separated list.
   * Supports dot notation for expanded relations: `cover.image_id`.
   */
  fields?: string | string[];
  /** Fields to exclude (cannot be combined with specific field selection). */
  exclude?: string | string[];
  /** Filter expression, e.g. `release_year = 2005 & cover != null`. */
  where?: string;
  /** Sort expression, e.g. `popularity_score desc`. */
  sort?: string;
  /** Maximum number of results (IGDB max: 500). */
  limit?: number;
  /** Pagination offset. */
  offset?: number;
  /** Full-text search term (quoted automatically). */
  search?: string;
}

/**
 * Serialize an {@link ApicalypseQuery} into the Apicalypse DSL string
 * that is sent as the POST body to IGDB endpoints.
 *
 * @example
 * buildQuery({
 *   fields: ['id', 'name', 'cover.image_id'],
 *   where: 'category = 0 & cover != null',
 *   sort: 'first_release_date asc',
 *   limit: 500,
 *   offset: 0,
 * });
 * // => "fields id, name, cover.image_id;\nwhere category = 0 & cover != null;\nsort first_release_date asc;\nlimit 500;\noffset 0;"
 */
export function buildQuery(q: ApicalypseQuery): string {
  const parts: string[] = [];

  if (q.fields !== undefined) {
    const f = Array.isArray(q.fields) ? q.fields.join(", ") : q.fields;
    parts.push(`fields ${f};`);
  }

  if (q.exclude !== undefined) {
    const e = Array.isArray(q.exclude) ? q.exclude.join(", ") : q.exclude;
    parts.push(`exclude ${e};`);
  }

  if (q.where !== undefined) {
    parts.push(`where ${q.where};`);
  }

  if (q.sort !== undefined) {
    parts.push(`sort ${q.sort};`);
  }

  if (q.limit !== undefined) {
    parts.push(`limit ${String(q.limit)};`);
  }

  if (q.offset !== undefined) {
    parts.push(`offset ${String(q.offset)};`);
  }

  if (q.search !== undefined) {
    parts.push(`search "${q.search}";`);
  }

  return parts.join("\n");
}
