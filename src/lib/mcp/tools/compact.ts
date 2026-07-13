/**
 * MCP Output Compaction Utilities
 *
 * Reduces token usage by:
 * - Omitting null/undefined values
 * - Omitting default values (empty arrays, false booleans)
 * - Shortening UUIDs in list contexts
 * - Rounding floats to avoid precision noise
 */

/**
 * Round a number to 2 decimal places (for currency amounts).
 * Avoids floating point noise like 92206.57999999999
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

/**
 * Convert Chinese currency names to ISO 4217 codes.
 */
const CURRENCY_MAP: Record<string, string> = {
  人民币: "CNY",
  美元: "USD",
  港币: "HKD",
  日元: "JPY",
  欧元: "EUR",
  英镑: "GBP",
};

export function currencyCode(currency: string): string {
  return CURRENCY_MAP[currency] ?? currency;
}
