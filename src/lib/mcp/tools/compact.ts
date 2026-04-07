/**
 * MCP Output Compaction Utilities
 *
 * Reduces token usage by:
 * - Omitting null/undefined values
 * - Omitting default values (empty arrays, false booleans)
 * - Shortening UUIDs in list contexts
 */

/**
 * Remove null, undefined, empty arrays, and false values from an object.
 * Keeps 0 and empty strings as they may be meaningful.
 */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip null/undefined
    if (value === null || value === undefined) continue;
    // Skip empty arrays
    if (Array.isArray(value) && value.length === 0) continue;
    // Skip false booleans (default)
    if (value === false) continue;
    result[key] = value;
  }
  return result as Partial<T>;
}

/**
 * Shorten a ULID/UUID to first 8 characters for list display.
 * Full ID is still available via get_* detail endpoints.
 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Compact an array of objects, applying compact() to each.
 */
export function compactArray<T extends Record<string, unknown>>(arr: T[]): Partial<T>[] {
  return arr.map(compact);
}

/**
 * Join category path from multiple levels, omitting nulls.
 * e.g., ["日常支出", "小吞金兽", null] → "日常支出/小吞金兽"
 */
export function categoryPath(...parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => p != null && p !== "").join("/");
}
