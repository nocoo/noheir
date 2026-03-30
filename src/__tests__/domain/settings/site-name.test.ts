import { describe, expect, it } from "bun:test";
import {
  getSiteNameDisplay,
  normalizeSiteName,
  validateSiteName,
} from "@/domain/settings/site-name";

describe("site-name domain", () => {
  it("normalizes site name by trimming", () => {
    expect(normalizeSiteName("  hello  ")).toBe("hello");
  });

  it("validates non-empty site name", () => {
    expect(validateSiteName("ok").valid).toBe(true);
    expect(validateSiteName("   ").valid).toBe(false);
  });

  it("returns default display for empty name", () => {
    expect(getSiteNameDisplay("")).toBe("未设置");
    expect(getSiteNameDisplay(undefined)).toBe("未设置");
  });
});
