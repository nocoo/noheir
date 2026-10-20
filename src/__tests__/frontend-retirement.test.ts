import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/lib/navigation";

describe("finance navigation after protocol retirement", () => {
  it("replaces retired model/protocol pages with reports and human API keys", () => {
    const paths = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(paths).not.toContain("/ai-insight");
    expect(paths).not.toContain("/ai-settings");
    expect(paths).not.toContain("/mcp-tokens");
    expect(paths).toContain("/api-keys");
    expect(paths).toContain("/analyses");
    expect(paths).toContain("/plan/calendar");
  });
  it("removes retired implementation rather than hiding it", () => {
    for (const path of [
      "src/app/ai-insight",
      "src/app/ai-settings",
      "src/app/mcp-tokens",
      "src/domain/settings/ai-config.ts",
      "src/domain/settings/mcp-config.ts",
      "src/domain/dashboard/ai-insight.ts",
      "src/lib/recurring-payment-detector.ts",
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
    expect(readFileSync("src/routes.tsx", "utf8")).not.toMatch(/ai-insight|ai-settings|mcp-tokens/);
  });
});
