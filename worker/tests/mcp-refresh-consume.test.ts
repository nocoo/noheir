import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";
import type { Db, DbMeta, DbQueryResult } from "../../src/lib/db";
import { consumeRefreshToken, revokeToken } from "../../src/services/mcp-tokens";

const DDL = `
CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  access_token_hash TEXT,
  access_token_preview TEXT,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT,
  expires_at TEXT NOT NULL,
  issued_at TEXT
);
CREATE TABLE mcp_refresh_tokens (
  id TEXT PRIMARY KEY,
  refresh_token_hash TEXT NOT NULL,
  access_token_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT
);
`;

function sqliteDb(sqlite: Database.Database): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<DbQueryResult<T>> {
      const stmt = sqlite.prepare(sql);
      const results = stmt.all(...params) as T[];
      return { results, meta: { changes: stmt.changes, duration: 0 } };
    },
    async firstOrNull<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      return (sqlite.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async execute(sql: string, params: unknown[] = []): Promise<DbMeta> {
      const info = sqlite.prepare(sql).run(...params);
      return { changes: info.changes, duration: 0 };
    },
    async batch() {
      return [];
    },
  };
}

describe("consumeRefreshToken parent revocation", () => {
  let sqlite: Database.Database;

  afterEach(() => {
    sqlite?.close();
  });

  function seedPair(opts: { accessRevoked: number; refreshRevoked?: number; clientId?: string }) {
    sqlite = new Database(":memory:");
    sqlite.exec(DDL);
    const clientId = opts.clientId ?? "client-1";
    sqlite
      .prepare(
        `INSERT INTO mcp_tokens (id, access_token_hash, access_token_preview, client_id, user_id, scope, revoked, expires_at, issued_at)
         VALUES ('tok-1', 'ah', 'prev', ?, 'user-1', 'mcp:full', ?, '2099-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(clientId, opts.accessRevoked);
    sqlite
      .prepare(
        `INSERT INTO mcp_refresh_tokens (id, refresh_token_hash, access_token_id, client_id, user_id, scope, expires_at, revoked)
         VALUES ('rt-1', 'refresh_hash', 'tok-1', ?, 'user-1', 'mcp:full', '2099-01-01T00:00:00.000Z', ?)`,
      )
      .run(clientId, opts.refreshRevoked ?? 0);
    return sqliteDb(sqlite);
  }

  test("revoked access token blocks paired refresh and does not burn it", async () => {
    const db = seedPair({ accessRevoked: 1 });
    const consumed = await consumeRefreshToken(db, "refresh_hash", "client-1");
    expect(consumed).toBeNull();
    const refresh = sqlite
      .prepare("SELECT revoked FROM mcp_refresh_tokens WHERE id = 'rt-1'")
      .get() as {
      revoked: number;
    };
    expect(refresh.revoked).toBe(0);
  });

  test("matching client and live parent consume the refresh once", async () => {
    const db = seedPair({ accessRevoked: 0 });
    const consumed = await consumeRefreshToken(db, "refresh_hash", "client-1");
    expect(consumed).toEqual({
      client_id: "client-1",
      user_id: "user-1",
      scope: "mcp:full",
      access_token_id: "tok-1",
    });
    expect(await consumeRefreshToken(db, "refresh_hash", "client-1")).toBeNull();
  });

  test("wrong client does not burn a valid refresh", async () => {
    const db = seedPair({ accessRevoked: 0 });
    expect(await consumeRefreshToken(db, "refresh_hash", "other-client")).toBeNull();
    const refresh = sqlite
      .prepare("SELECT revoked FROM mcp_refresh_tokens WHERE id = 'rt-1'")
      .get() as {
      revoked: number;
    };
    expect(refresh.revoked).toBe(0);
  });

  test("revokeToken revokes the access/refresh pair", async () => {
    const db = seedPair({ accessRevoked: 0 });
    expect(await revokeToken(db, "tok-1")).toBe(true);
    const access = sqlite.prepare("SELECT revoked FROM mcp_tokens WHERE id = 'tok-1'").get() as {
      revoked: number;
    };
    const refresh = sqlite
      .prepare("SELECT revoked FROM mcp_refresh_tokens WHERE id = 'rt-1'")
      .get() as {
      revoked: number;
    };
    expect(access.revoked).toBe(1);
    expect(refresh.revoked).toBe(1);
    expect(await consumeRefreshToken(db, "refresh_hash", "client-1")).toBeNull();
  });
});
