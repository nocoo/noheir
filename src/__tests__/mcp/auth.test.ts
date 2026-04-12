/**
 * Tests for MCP auth utilities
 *
 * L1 unit tests for extractBearerToken and validateOrigin.
 */

import { describe, it, expect } from "bun:test";
import { extractBearerToken, validateOrigin } from "@/lib/mcp/auth";

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
    // The regex requires \S+ (non-whitespace), so "Bearer abc 123" doesn't match
    expect(extractBearerToken("Bearer abc 123")).toBeNull();
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
      // With invalid siteUrl, still check other rules
      const result = validateOrigin("https://evil.com", "not-a-url");
      expect(result).not.toBeNull();
      expect(result?.valid).toBe(false);
    });

    it("should handle siteUrl with trailing slash", () => {
      expect(validateOrigin("https://noheir.hexly.ai", "https://noheir.hexly.ai/")).toBeNull();
    });

    it("should block origin with path (origin format should not have path)", () => {
      // URL.origin strips path, so "https://noheir.hexly.ai/path" origin is "https://noheir.hexly.ai"
      // But validateOrigin compares the full input string, not parsed origin
      // In practice this doesn't happen as browsers send clean origin headers
      const result = validateOrigin("https://noheir.hexly.ai/path", siteUrl);
      // The implementation compares raw strings, so path makes it not match
      expect(result?.valid).toBe(false);
    });
  });
});
