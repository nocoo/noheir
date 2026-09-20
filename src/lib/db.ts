/**
 * Portable SQL adapter used by MCP OAuth and tools.
 *
 * Request-scoped: construct with createD1Db(env.DB) per request.
 * There is no process-global singleton and no HTTP SQL bridge.
 */

export interface DbQueryResult<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number; duration: number };
}

export interface DbMeta {
  changes: number;
  duration: number;
}

export interface DbBatchStatement {
  sql: string;
  params?: unknown[];
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>>;
  firstOrNull<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<DbMeta>;
  batch(statements: DbBatchStatement[]): Promise<DbQueryResult[]>;
}

function bindAll(d1: D1Database, sql: string, params?: unknown[]): D1PreparedStatement {
  const stmt = d1.prepare(sql);
  if (!params || params.length === 0) return stmt;
  return stmt.bind(...params);
}

/** Per-request D1 adapter. Do not cache across requests. */
export function createD1Db(d1: D1Database): Db {
  const db: Db = {
    async query<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>> {
      const start = Date.now();
      const result = await bindAll(d1, sql, params).all();
      return {
        results: (result.results ?? []) as T[],
        meta: { changes: result.meta.changes ?? 0, duration: Date.now() - start },
      };
    },

    async firstOrNull<T>(sql: string, params?: unknown[]): Promise<T | null> {
      const result = await db.query<T>(sql, params);
      return result.results[0] ?? null;
    },

    async execute(sql: string, params?: unknown[]): Promise<DbMeta> {
      const start = Date.now();
      const result = await bindAll(d1, sql, params).run();
      return { changes: result.meta.changes ?? 0, duration: Date.now() - start };
    },

    async batch(statements: DbBatchStatement[]): Promise<DbQueryResult[]> {
      const start = Date.now();
      const prepared = statements.map((s) => bindAll(d1, s.sql, s.params));
      const batchResults = await d1.batch(prepared);
      const duration = Date.now() - start;
      return batchResults.map((r) => ({
        results: (r.results ?? []) as Record<string, unknown>[],
        meta: { changes: r.meta?.changes ?? 0, duration },
      }));
    },
  };
  return db;
}
