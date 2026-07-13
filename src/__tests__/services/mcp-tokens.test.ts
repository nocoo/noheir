/**
 * Tests for MCP token service
 *
 * Tests all CRUD operations and helper functions for MCP OAuth tokens.
 */

import { describe, expect, it } from "vitest";
import type { Db, DbMeta, DbQueryResult } from "../../lib/db";
import type { CreateMcpTokenInput, McpToken } from "../../services/mcp-tokens";

import {
  ACCESS_TOKEN_TTL,
  createMcpToken,
  generateAccessToken,
  generateRefreshToken,
  getMcpTokenById,
  getValidTokenByHash,
  getValidTokenByRefreshHash,
  listMcpTokens,
  REFRESH_TOKEN_TTL,
  randomHex,
  revokeToken,
  revokeTokensByClientAndUser,
  sha256,
  updateLastUsed,
} from "../../services/mcp-tokens";

/** Safe array access for test assertions */
function at<T>(arr: T[], i: number): T {
  const item = arr[i];
  if (item === undefined) throw new Error(`Expected item at index ${i}`);
  return item;
}

// ---------------------------------------------------------------------------
// Mock Db factory
// ---------------------------------------------------------------------------

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
      return {
        results: (overrides.queryResults ?? []) as T[],
        meta: { changes: 0, duration: 1 },
      };
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

// ---------------------------------------------------------------------------
// Token generation helpers
// ---------------------------------------------------------------------------

describe("randomHex", () => {
  it("should generate hex string of correct length", () => {
    const hex = randomHex(16);
    expect(hex).toHaveLength(32);
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });

  it("should generate different values each call", () => {
    const a = randomHex(16);
    const b = randomHex(16);
    expect(a).not.toBe(b);
  });

  it("should handle small byte counts", () => {
    const hex = randomHex(1);
    expect(hex).toHaveLength(2);
  });
});

describe("sha256", () => {
  it("should produce a 64-char hex string", async () => {
    const hash = await sha256("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("should be deterministic", async () => {
    const a = await sha256("test-input");
    const b = await sha256("test-input");
    expect(a).toBe(b);
  });

  it("should produce different hashes for different inputs", async () => {
    const a = await sha256("input-a");
    const b = await sha256("input-b");
    expect(a).not.toBe(b);
  });
});

describe("generateAccessToken", () => {
  it("should start with noheir_at_ prefix", () => {
    const token = generateAccessToken();
    expect(token.startsWith("noheir_at_")).toBe(true);
  });

  it("should have correct length (prefix + 48 hex chars)", () => {
    const token = generateAccessToken();
    expect(token).toHaveLength("noheir_at_".length + 48);
  });
});

describe("generateRefreshToken", () => {
  it("should start with noheir_rt_ prefix", () => {
    const token = generateRefreshToken();
    expect(token.startsWith("noheir_rt_")).toBe(true);
  });

  it("should have correct length (prefix + 48 hex chars)", () => {
    const token = generateRefreshToken();
    expect(token).toHaveLength("noheir_rt_".length + 48);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("ACCESS_TOKEN_TTL should be 30 days in seconds", () => {
    expect(ACCESS_TOKEN_TTL).toBe(30 * 24 * 60 * 60);
  });

  it("REFRESH_TOKEN_TTL should be 90 days in seconds", () => {
    expect(REFRESH_TOKEN_TTL).toBe(90 * 24 * 60 * 60);
  });
});

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

const baseInput: CreateMcpTokenInput = {
  access_token_hash: "hash_abc",
  access_token_preview: "noheir_at_abc...xyz",
  refresh_token_hash: "hash_refresh",
  client_id: "client-1",
  user_id: "user-1",
};

const fakeToken: McpToken = {
  id: "01TEST1234567890123456789",
  access_token_hash: "hash_abc",
  access_token_preview: "noheir_at_abc...xyz",
  client_id: "client-1",
  user_id: "user-1",
  client_name: null,
  scope: "mcp:full",
  revoked: 0,
  revoked_at: null,
  expires_at: "2026-05-17T00:00:00.000Z",
  last_used_at: null,
  issued_at: "2026-04-17T00:00:00.000Z",
};

describe("createMcpToken", () => {
  it("should insert access token and refresh token, then return the created token", async () => {
    const { db, calls } = createMockDb({ firstOrNullResult: fakeToken });

    const result = await createMcpToken(db, baseInput);

    expect(calls).toHaveLength(3);
    expect(at(calls, 0).sql).toContain("INSERT INTO mcp_tokens");
    expect(at(calls, 1).sql).toContain("INSERT INTO mcp_refresh_tokens");
    expect(at(calls, 2).sql).toContain("SELECT * FROM mcp_tokens WHERE id = ?");
    expect(result).toEqual(fakeToken);
  });

  it("should use default scope 'mcp:full' when not provided", async () => {
    const { db, calls } = createMockDb({ firstOrNullResult: fakeToken });

    await createMcpToken(db, baseInput);

    expect(at(calls, 0).params).toContain("mcp:full");
  });

  it("should use provided scope", async () => {
    const { db, calls } = createMockDb({ firstOrNullResult: fakeToken });

    await createMcpToken(db, { ...baseInput, scope: "mcp:read" });

    expect(at(calls, 0).params).toContain("mcp:read");
  });

  it("should use provided client_name", async () => {
    const { db, calls } = createMockDb({ firstOrNullResult: fakeToken });

    await createMcpToken(db, { ...baseInput, client_name: "My App" });

    expect(at(calls, 0).params).toContain("My App");
  });

  it("should throw if token not found after creation", async () => {
    const { db } = createMockDb({ firstOrNullResult: null });

    expect(createMcpToken(db, baseInput)).rejects.toThrow("Failed to retrieve mcp_token");
  });
});

describe("getMcpTokenById", () => {
  it("should return token when found", async () => {
    const { db } = createMockDb({ firstOrNullResult: fakeToken });
    const result = await getMcpTokenById(db, "01TEST");
    expect(result).toEqual(fakeToken);
  });

  it("should return null when not found", async () => {
    const { db } = createMockDb({ firstOrNullResult: null });
    const result = await getMcpTokenById(db, "nonexistent");
    expect(result).toBeNull();
  });
});

describe("getValidTokenByHash", () => {
  it("should query with hash and check revoked/expired", async () => {
    const { db, calls } = createMockDb({ firstOrNullResult: fakeToken });

    const result = await getValidTokenByHash(db, "hash_abc");

    expect(result).toEqual(fakeToken);
    expect(at(calls, 0).sql).toContain("access_token_hash = ?");
    expect(at(calls, 0).sql).toContain("revoked = 0");
    expect(at(calls, 0).sql).toContain("expires_at > ?");
    expect(at(calls, 0).params[0]).toBe("hash_abc");
  });

  it("should return null when no valid token", async () => {
    const { db } = createMockDb({ firstOrNullResult: null });
    const result = await getValidTokenByHash(db, "hash_abc");
    expect(result).toBeNull();
  });
});

describe("getValidTokenByRefreshHash", () => {
  it("should join mcp_refresh_tokens and check both token and refresh validity", async () => {
    const tokenWithRefresh = { ...fakeToken, refresh_token_id: "01REFRESH" };
    const { db, calls } = createMockDb({ firstOrNullResult: tokenWithRefresh });

    const result = await getValidTokenByRefreshHash(db, "refresh_hash");

    expect(result).toEqual(tokenWithRefresh);
    expect(at(calls, 0).sql).toContain("mcp_refresh_tokens");
    expect(at(calls, 0).sql).toContain("r.refresh_token_hash = ?");
    expect(at(calls, 0).sql).toContain("r.revoked = 0");
    expect(at(calls, 0).sql).toContain("t.revoked = 0");
    expect(at(calls, 0).params[0]).toBe("refresh_hash");
  });

  it("should return null when no valid refresh token", async () => {
    const { db } = createMockDb({ firstOrNullResult: null });
    const result = await getValidTokenByRefreshHash(db, "invalid_hash");
    expect(result).toBeNull();
  });
});

describe("updateLastUsed", () => {
  it("should update last_used_at for the given token id", async () => {
    const { db, calls } = createMockDb();

    await updateLastUsed(db, "01TEST");

    expect(calls).toHaveLength(1);
    expect(at(calls, 0).sql).toContain("UPDATE mcp_tokens SET last_used_at = ?");
    expect(at(calls, 0).params[1]).toBe("01TEST");
  });
});

describe("revokeToken", () => {
  it("should return true when token was revoked", async () => {
    const { db } = createMockDb({ executeMeta: { changes: 1 } });
    const result = await revokeToken(db, "01TEST");
    expect(result).toBe(true);
  });

  it("should return false when token was already revoked or not found", async () => {
    const { db } = createMockDb({ executeMeta: { changes: 0 } });
    const result = await revokeToken(db, "01TEST");
    expect(result).toBe(false);
  });

  it("should set revoked=1 and revoked_at", async () => {
    const { db, calls } = createMockDb({ executeMeta: { changes: 1 } });
    await revokeToken(db, "01TEST");

    expect(at(calls, 0).sql).toContain("revoked = 1");
    expect(at(calls, 0).sql).toContain("revoked_at = ?");
    expect(at(calls, 0).sql).toContain("revoked = 0");
  });
});

describe("revokeTokensByClientAndUser", () => {
  it("should revoke both access and refresh tokens", async () => {
    const { db, calls } = createMockDb({ executeMeta: { changes: 3 } });

    const count = await revokeTokensByClientAndUser(db, "client-1", "user-1");

    expect(count).toBe(3);
    expect(calls).toHaveLength(2);
    expect(at(calls, 0).sql).toContain("UPDATE mcp_tokens");
    expect(at(calls, 0).sql).toContain("client_id = ?");
    expect(at(calls, 0).sql).toContain("user_id = ?");
    expect(at(calls, 1).sql).toContain("UPDATE mcp_refresh_tokens");
  });

  it("should return 0 when nothing to revoke", async () => {
    const { db } = createMockDb({ executeMeta: { changes: 0 } });
    const count = await revokeTokensByClientAndUser(db, "client-1", "user-1");
    expect(count).toBe(0);
  });
});

describe("listMcpTokens", () => {
  it("should return all tokens ordered by issued_at DESC", async () => {
    const tokens = [fakeToken, { ...fakeToken, id: "02TEST" }];
    const { db, calls } = createMockDb({ queryResults: tokens });

    const result = await listMcpTokens(db);

    expect(result).toEqual(tokens);
    expect(at(calls, 0).sql).toContain("SELECT * FROM mcp_tokens ORDER BY issued_at DESC");
  });

  it("should return empty array when no tokens", async () => {
    const { db } = createMockDb({ queryResults: [] });
    const result = await listMcpTokens(db);
    expect(result).toEqual([]);
  });
});
