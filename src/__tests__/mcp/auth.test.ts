/**
 * Tests for MCP auth utilities
 *
 * L1 unit tests for extractBearerToken, validateOrigin, and validateMcpToken.
 */

import { describe, it, expect, mock } from "bun:test";
import { extractBearerToken, validateOrigin, validateMcpToken } from "@/lib/mcp/auth";
import type { McpToken } from "@/services/mcp-tokens";

// Mock the mcp-tokens service
const mockGetValidTokenByHash = mock(() => Promise.resolve(null as McpToken | null));
const mockUpdateLastUsed = mock(() => Promise.resolve());
const mockSha256 = mock((input: string) => Promise.resolve(`hashed-${input}`));

mock.module("@/services/mcp-tokens", () => ({
  getValidTokenByHash: mockGetValidTokenByHash,
  updateLastUsed: mockUpdateLastUsed,
  sha256: mockSha256,
}));

const fakeDb = {} as Parameters<typeof validateMcpToken>[0];

const fakeToken: McpToken = {
  id: "tok-1",
  access_token_hash: "hashed-abc123",
  access_token_preview: "abc1…",
  client_id: "client-1",
  user_id: "user-1",
  client_name: "Test Client",
  scope: "read write",
  revoked: 0,
  revoked_at: null,
  expires_at: "2099-12-31T00:00:00Z",
  last_used_at: null,
  issued_at: "2026-01-01T00:00:00Z",
};

describe("extractBearerToken", () => {
  it("should extract token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("bearer ABC123")).toBe("ABC123");
    expect(extractBearerToken("BEARER xyz")).toBe("xyz");
  });

  it("should return null for null header", () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(extractBearerToken("")).toBeNull();
  });

  it("should return null for malformed headers", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer ")).toBeNull();
    expect(extractBearerToken("Bearerabc123")).toBeNull();
    expect(extractBearerToken("abc123")).toBeNull();
  });

  it("should handle token with special characters", () => {
    expect(extractBearerToken("Bearer abc-123_XYZ")).toBe("abc-123_XYZ");
    expect(extractBearerToken("Bearer a.b.c")).toBe("a.b.c");
  });

  it("should return null for token with space (malformed)", () => {
    expect(extractBearerToken("Bearer abc 123")).toBeNull();
  });
});

describe("validateMcpToken", () => {
  it("returns error for null auth header", async () => {
    const result = await validateMcpToken(fakeDb, null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
      expect(result.error).toContain("Missing");
    }
  });

  it("returns error for malformed auth header", async () => {
    const result = await validateMcpToken(fakeDb, "Basic abc");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
    }
  });

  it("returns error for invalid/expired token", async () => {
    mockGetValidTokenByHash.mockResolvedValueOnce(null);
    const result = await validateMcpToken(fakeDb, "Bearer invalid-token");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(401);
      expect(result.error).toContain("Invalid");
    }
  });

  it("returns success for valid token", async () => {
    mockGetValidTokenByHash.mockResolvedValueOnce(fakeToken);
    const result = await validateMcpToken(fakeDb, "Bearer abc123");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.token.id).toBe("tok-1");
    }
  });

  it("calls updateLastUsed on success (fire-and-forget)", async () => {
    mockGetValidTokenByHash.mockResolvedValueOnce(fakeToken);
    mockUpdateLastUsed.mockClear();
    await validateMcpToken(fakeDb, "Bearer abc123");
    expect(mockUpdateLastUsed).toHaveBeenCalled();
  });

  it("swallows updateLastUsed errors silently", async () => {
    mockGetValidTokenByHash.mockResolvedValueOnce(fakeToken);
    mockUpdateLastUsed.mockRejectedValueOnce(new Error("db error"));
    // Should not throw
    const result = await validateMcpToken(fakeDb, "Bearer abc123");
    expect(result.valid).toBe(true);
  });
});

describe("validateOrigin", () => {
  const siteUrl = "https://noheir.hexly.ai";

  describe("allowed origins", () => {
    it("should allow missing origin (CLI clients)", () => {
      expect(validateOrigin(null, siteUrl)).toBeNull();
    });

    it("should allow matching site origin", () => {
      expect(validateOrigin("https://noheir.hexly.ai", siteUrl)).toBeNull();
    });

    it("should allow localhost origins", () => {
      expect(validateOrigin("http://localhost", siteUrl)).toBeNull();
      expect(validateOrigin("http://localhost:3000", siteUrl)).toBeNull();
      expect(validateOrigin("http://127.0.0.1", siteUrl)).toBeNull();
      expect(validateOrigin("http://127.0.0.1:8080", siteUrl)).toBeNull();
      expect(validateOrigin("http://[::1]", siteUrl)).toBeNull();
      expect(validateOrigin("http://[::1]:3000", siteUrl)).toBeNull();
    });

    it("should allow non-web protocols (desktop clients)", () => {
      expect(validateOrigin("vscode-file://vscode-app", siteUrl)).toBeNull();
      expect(validateOrigin("electron://app", siteUrl)).toBeNull();
      expect(validateOrigin("tauri://localhost", siteUrl)).toBeNull();
      expect(validateOrigin("file:///path/to/file", siteUrl)).toBeNull();
    });
  });

  describe("blocked origins", () => {
    it("should block non-matching https origins", () => {
      const result = validateOrigin("https://evil.com", siteUrl);
      expect(result).not.toBeNull();
      expect(result?.valid).toBe(false);
      expect(result?.status).toBe(403);
      expect(result?.error).toBe("Origin not allowed");
    });

    it("should block non-matching http origins", () => {
      const result = validateOrigin("http://evil.com", siteUrl);
      expect(result).not.toBeNull();
      expect(result?.valid).toBe(false);
      expect(result?.status).toBe(403);
    });

    it("should block malformed origins", () => {
      const result = validateOrigin("not-a-url", siteUrl);
      expect(result).not.toBeNull();
      expect(result?.valid).toBe(false);
      expect(result?.status).toBe(403);
    });

    it("should block https localhost (only http allowed)", () => {
      const result = validateOrigin("https://localhost:3000", siteUrl);
      expect(result).not.toBeNull();
      expect(result?.valid).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle invalid siteUrl gracefully", () => {
      const result = validateOrigin("https://evil.com", "not-a-url");
      expect(result).not.toBeNull();
      expect(result?.valid).toBe(false);
    });

    it("should handle siteUrl with trailing slash", () => {
      expect(validateOrigin("https://noheir.hexly.ai", "https://noheir.hexly.ai/")).toBeNull();
    });

    it("should block origin with path (origin format should not have path)", () => {
      const result = validateOrigin("https://noheir.hexly.ai/path", siteUrl);
      expect(result?.valid).toBe(false);
    });
  });
});
