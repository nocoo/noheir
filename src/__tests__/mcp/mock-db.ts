/**
 * Mock database for MCP tools testing
 *
 * Provides an in-memory implementation of the Db interface.
 */

import type { Db, DbQueryResult, DbMeta, DbBatchStatement } from "@/lib/db";

interface MockTable {
  name: string;
  rows: Record<string, unknown>[];
}

interface MockDbOptions {
  tables?: Record<string, Record<string, unknown>[]>;
}

/**
 * Create a mock database for testing.
 *
 * Supports simple queries with WHERE conditions.
 * Not a full SQL parser - just enough for MCP tools testing.
 */
export function createMockDb(options: MockDbOptions = {}): Db & {
  tables: Map<string, MockTable>;
  reset: () => void;
  setTable: (name: string, rows: Record<string, unknown>[]) => void;
} {
  const tables = new Map<string, MockTable>();

  // Initialize with provided data
  if (options.tables) {
    for (const [name, rows] of Object.entries(options.tables)) {
      tables.set(name, { name, rows: [...rows] });
    }
  }

  function parseSimpleSelect(sql: string, params: unknown[]): Record<string, unknown>[] {
    // Very basic SQL parsing - enough for our tests
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (!fromMatch) return [];

    const tableName = fromMatch[1];
    if (!tableName) return [];

    const table = tables.get(tableName);
    if (!table) return [];

    let rows = [...table.rows];

    // Handle WHERE clause with simple conditions
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)/i);
    if (whereMatch && whereMatch[1]) {
      const whereClause = whereMatch[1].trim();
      let paramIndex = 0;

      // Parse conditions (simplified)
      const conditions = whereClause.split(/\s+AND\s+/i);

      for (const condition of conditions) {
        const trimmed = condition.trim();

        // user_id = ?
        const eqMatch = trimmed.match(/^(\w+)\s*=\s*\?$/);
        if (eqMatch && eqMatch[1]) {
          const field = eqMatch[1];
          const value = params[paramIndex++];
          rows = rows.filter((r) => r[field] === value);
          continue;
        }

        // field >= ?
        const gteMatch = trimmed.match(/^(\w+)\s*>=\s*\?$/);
        if (gteMatch && gteMatch[1]) {
          const field = gteMatch[1];
          const value = params[paramIndex++];
          rows = rows.filter((r) => {
            const fieldValue = r[field];
            if (typeof fieldValue === "string" && typeof value === "string") {
              return fieldValue >= value;
            }
            if (typeof fieldValue === "number" && typeof value === "number") {
              return fieldValue >= value;
            }
            return false;
          });
          continue;
        }

        // field <= ?
        const lteMatch = trimmed.match(/^(\w+)\s*<=\s*\?$/);
        if (lteMatch && lteMatch[1]) {
          const field = lteMatch[1];
          const value = params[paramIndex++];
          rows = rows.filter((r) => {
            const fieldValue = r[field];
            if (typeof fieldValue === "string" && typeof value === "string") {
              return fieldValue <= value;
            }
            if (typeof fieldValue === "number" && typeof value === "number") {
              return fieldValue <= value;
            }
            return false;
          });
          continue;
        }

        // strftime('%Y', date) = ?
        if (trimmed.includes("strftime('%Y'")) {
          const value = String(params[paramIndex++]);
          rows = rows.filter((r) => {
            const date = r.date;
            if (typeof date !== "string") return false;
            return date.substring(0, 4) === value;
          });
          continue;
        }

        // CAST(strftime('%m', date) AS INTEGER) = ?
        if (trimmed.includes("strftime('%m'")) {
          const value = params[paramIndex++];
          rows = rows.filter((r) => {
            const date = r.date;
            if (typeof date !== "string") return false;
            const month = parseInt(date.substring(5, 7), 10);
            return month === value;
          });
          continue;
        }

        // field IN (?, ?, ...)
        const inMatch = trimmed.match(/^(\w+)\s+IN\s*\(([\s?,]+)\)/i);
        if (inMatch && inMatch[1] && inMatch[2]) {
          const field = inMatch[1];
          const placeholderCount = (inMatch[2].match(/\?/g) || []).length;
          const values = params.slice(paramIndex, paramIndex + placeholderCount);
          paramIndex += placeholderCount;
          rows = rows.filter((r) => values.includes(r[field]));
          continue;
        }

        // LIKE condition (for keyword search)
        if (trimmed.includes("LIKE")) {
          // Skip for now - increment param index for each ?
          const likeCount = (trimmed.match(/\?/g) || []).length;
          paramIndex += likeCount;
          // Don't filter - let all rows through for simplicity
          continue;
        }

        // amount_cents >= ?
        const amountGteMatch = trimmed.match(/^amount_cents\s*>=\s*\?$/);
        if (amountGteMatch) {
          const value = params[paramIndex++] as number;
          rows = rows.filter((r) => {
            const fieldValue = r.amount_cents;
            return typeof fieldValue === "number" && fieldValue >= value;
          });
          continue;
        }

        // amount_cents <= ?
        const amountLteMatch = trimmed.match(/^amount_cents\s*<=\s*\?$/);
        if (amountLteMatch) {
          const value = params[paramIndex++] as number;
          rows = rows.filter((r) => {
            const fieldValue = r.amount_cents;
            return typeof fieldValue === "number" && fieldValue <= value;
          });
          continue;
        }
      }
    }

    // Handle LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+|\?)/i);
    if (limitMatch) {
      let limit: number;
      if (limitMatch[1] === "?") {
        // Find the limit param - it's after WHERE params
        const whereParamCount = (sql.substring(0, sql.search(/LIMIT/i)).match(/\?/g) || []).length;
        limit = params[whereParamCount] as number;
      } else {
        limit = parseInt(limitMatch[1] ?? "50", 10);
      }
      rows = rows.slice(0, limit);
    }

    // Handle ORDER BY (just reverse for DESC)
    if (sql.match(/ORDER\s+BY.+DESC/i)) {
      rows = rows.reverse();
    }

    return rows;
  }

  const db: Db & {
    tables: Map<string, MockTable>;
    reset: () => void;
    setTable: (name: string, rows: Record<string, unknown>[]) => void;
  } = {
    tables,

    reset() {
      tables.clear();
    },

    setTable(name: string, rows: Record<string, unknown>[]) {
      tables.set(name, { name, rows: [...rows] });
    },

    async query<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>> {
      const results = parseSimpleSelect(sql, params ?? []) as T[];
      return {
        results,
        meta: { changes: 0, duration: 1 },
      };
    },

    async firstOrNull<T>(sql: string, params?: unknown[]): Promise<T | null> {
      const result = await db.query<T>(sql, params);
      return result.results[0] ?? null;
    },

    async execute(_sql: string, _params?: unknown[]): Promise<DbMeta> {
      // For write operations, just return success
      return { changes: 1, duration: 1 };
    },

    async batch(_statements: DbBatchStatement[]): Promise<DbQueryResult[]> {
      return [];
    },
  };

  return db;
}
