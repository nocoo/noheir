/**
 * Normalization for `contribution_logs.created_at`, which exists in three
 * incompatible encodings in production (see docs/003 § B1):
 *   - `auto` / `import` rows: integer milliseconds
 *   - `mcp` rows:             ISO-8601 text
 *   - Drizzle-written rows:   integer seconds (schema declares mode:"timestamp")
 *
 * Callers must pass the RAW column value. Drizzle's timestamp codec decodes
 * `value * 1000`, which turns a millisecond row into year ~58500 and an ISO
 * text row into `Invalid Date`, destroying the information we need here.
 */

/** Values at or above this are milliseconds; below, seconds. Unambiguous
 * because seconds and milliseconds for any date from 2001 to 5138 differ by
 * three orders of magnitude. */
const MS_THRESHOLD = 1e12;

export function normalizeLogTimestamp(raw: unknown): number | null {
  if (raw == null) return null;

  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isNaN(t) ? null : t;
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw >= MS_THRESHOLD ? raw : raw * 1000;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    if (/^\d+$/.test(trimmed)) return normalizeLogTimestamp(Number(trimmed));
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export interface TimelineSortable {
  operationDate: string;
  createdAtMs: number | null;
  id: string;
}

/**
 * operationDate DESC → createdAtMs DESC (nulls last) → id DESC.
 *
 * Dates are compared by their first 10 characters: 132 legacy rows hold a full
 * ISO timestamp, and comparing raw would sort them after every plain-date entry
 * on the same day instead of falling through to the createdAtMs tiebreak.
 */
export function compareLogsForTimeline(a: TimelineSortable, b: TimelineSortable): number {
  const dateA = a.operationDate.slice(0, 10);
  const dateB = b.operationDate.slice(0, 10);
  if (dateA !== dateB) {
    return dateA < dateB ? 1 : -1;
  }
  if (a.createdAtMs !== b.createdAtMs) {
    if (a.createdAtMs == null) return 1;
    if (b.createdAtMs == null) return -1;
    return b.createdAtMs - a.createdAtMs;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function sortLogsForTimeline<T extends TimelineSortable>(logs: T[]): T[] {
  return [...logs].sort(compareLogsForTimeline);
}
