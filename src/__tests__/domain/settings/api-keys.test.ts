import { describe, expect, it } from "vitest";
import { API_SCOPES, type ApiKeyInfo } from "@/domain/api-contract";
import { buildKeyInput, getKeyStatus, KEY_PRESETS, toggleScope } from "@/domain/settings/api-keys";

describe("API key issuance view model", () => {
  it("expands finite non-destructive presets without implicit privileges", () => {
    for (const preset of Object.values(KEY_PRESETS)) {
      expect(preset.length).toBeGreaterThan(0);
      expect(new Set(preset).size).toBe(preset.length);
      expect(preset.every((scope) => API_SCOPES.includes(scope))).toBe(true);
      expect(preset.some((scope) => scope.endsWith(":delete") || scope === "data:replace")).toBe(
        false,
      );
    }
    expect(KEY_PRESETS.reports).toContain("analyses:write");
    expect(KEY_PRESETS.analyst.every((scope) => scope.endsWith(":read"))).toBe(true);
  });
  it("validates explicit grants and mandatory bounded expiry, trimming labels", () => {
    expect(buildKeyInput("  Reports ", ["analyses:write"], "90")).toEqual({
      label: "Reports",
      scopes: ["analyses:write"],
      expiresInDays: 90,
    });
    for (const days of ["", "0", "366", "1.5", "NaN"])
      expect(() => buildKeyInput("Reports", ["analyses:read"], days)).toThrow();
    expect(() => buildKeyInput("", ["analyses:read"], "90")).toThrow();
    expect(() => buildKeyInput("Reports", [], "90")).toThrow();
    expect(() => buildKeyInput("Reports", ["analyses:read", "analyses:read"], "90")).toThrow();
    expect(toggleScope(["analyses:read"], "analyses:write")).toEqual([
      "analyses:read",
      "analyses:write",
    ]);
    expect(toggleScope(["analyses:read"], "analyses:read")).toEqual([]);
  });
  it("gives revocation precedence over expiry and uses inclusive expiry boundary", () => {
    const key = { expiresAt: "2026-10-21T00:00:00Z", revokedAt: null } as ApiKeyInfo;
    const now = Date.parse("2026-10-20T00:00:00Z");
    expect(getKeyStatus(key, now)).toBe("active");
    expect(getKeyStatus(key, Date.parse(key.expiresAt))).toBe("expired");
    expect(getKeyStatus({ ...key, revokedAt: "2026-10-19T00:00:00Z" }, now)).toBe("revoked");
  });
});
