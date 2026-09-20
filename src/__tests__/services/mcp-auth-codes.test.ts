import { describe, expect, it } from "vitest";
import type { Db, DbMeta, DbQueryResult } from "../../lib/db";
import {
  AUTH_CODE_TTL,
  consumeAuthCode,
  createAuthSession,
  getAuthCodeByCode,
  getAuthSessionByState,
  upgradeAuthSession,
} from "../../services/mcp-auth-codes";

interface MockCall {
  sql: string;
  params: unknown[];
}

function createMockDb(
  overrides: {
    queryResults?: unknown[];
    firstOrNullResult?: unknown;
    executeMeta?: Partial<DbMeta>;
  } = {},
) {
  const calls: MockCall[] = [];
  const db: Db = {
    async query<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>> {
      calls.push({ sql, params: params ?? [] });
      return { results: (overrides.queryResults ?? []) as T[], meta: { changes: 0, duration: 1 } };
    },
    async firstOrNull<T>(sql: string, params?: unknown[]): Promise<T | null> {
      calls.push({ sql, params: params ?? [] });
      return (overrides.firstOrNullResult ?? null) as T | null;
    },
    async execute(sql: string, params?: unknown[]): Promise<DbMeta> {
      calls.push({ sql, params: params ?? [] });
      return { changes: overrides.executeMeta?.changes ?? 1, duration: 1 };
    },
    async batch() {
      return [];
    },
  };
  return { db, calls };
}

describe("createAuthSession", () => {
  it("requires user_id and binds it at insert", async () => {
    const { db, calls } = createMockDb();
    await createAuthSession(db, {
      state: "st",
      client_id: "client-1",
      redirect_uri: "http://127.0.0.1/cb",
      code_challenge: "challenge",
      expires_at: 1_700_000_000,
      user_id: "google-sub-original",
    });
    expect(calls[0]?.sql).toContain("user_id");
    expect(calls[0]?.params).toContain("google-sub-original");
    expect(calls[0]?.params).toContain("client-1");
  });

  it("defaults PKCE method and scope", async () => {
    const { db, calls } = createMockDb();
    await createAuthSession(db, {
      state: "st",
      client_id: "c",
      redirect_uri: "http://127.0.0.1/cb",
      code_challenge: "ch",
      expires_at: 1,
      user_id: "u1",
    });
    expect(calls[0]?.params).toContain("S256");
    expect(calls[0]?.params).toContain("mcp:full");
  });
});

describe("upgradeAuthSession", () => {
  it("preserves the bound user_id instead of overwriting it", async () => {
    const { db, calls } = createMockDb({ executeMeta: { changes: 1 } });
    const ok = await upgradeAuthSession(db, "st", "code", "google-sub-original");
    expect(ok).toBe(true);
    expect(calls[0]?.sql).toMatch(/SET code = \?, expires_at = \?/);
    expect(calls[0]?.sql).toContain("AND user_id = ?");
    expect(calls[0]?.params.at(-1)).toBe("google-sub-original");
  });

  it("returns false when the user does not match", async () => {
    const { db } = createMockDb({ executeMeta: { changes: 0 } });
    expect(await upgradeAuthSession(db, "st", "code", "other-user")).toBe(false);
  });
});

describe("consumeAuthCode", () => {
  it("consumes atomically with client_id and expiry", async () => {
    const { db, calls } = createMockDb({ executeMeta: { changes: 1 } });
    expect(await consumeAuthCode(db, "code-1", "client-1")).toBe(true);
    expect(calls[0]?.sql).toContain("client_id = ?");
    expect(calls[0]?.sql).toContain("consumed = 0");
    expect(calls[0]?.sql).toContain("expires_at > ?");
    expect(calls[0]?.params[0]).toBe("code-1");
    expect(calls[0]?.params[1]).toBe("client-1");
  });

  it("wrong client does not report consume", async () => {
    const { db, calls } = createMockDb({ executeMeta: { changes: 0 } });
    expect(await consumeAuthCode(db, "code-1", "other-client")).toBe(false);
    expect(calls[0]?.params[1]).toBe("other-client");
  });
});

describe("lookups", () => {
  it("loads unconsumed unexpired codes and sessions", async () => {
    const { db, calls } = createMockDb({ firstOrNullResult: { id: "s" } });
    expect(await getAuthCodeByCode(db, "code-1")).toEqual({ id: "s" });
    expect(calls[0]?.sql).toContain("consumed = 0");
    expect(await getAuthSessionByState(db, "st")).toEqual({ id: "s" });
  });

  it("AUTH_CODE_TTL is 10 minutes", () => {
    expect(AUTH_CODE_TTL).toBe(10 * 60);
  });
});
