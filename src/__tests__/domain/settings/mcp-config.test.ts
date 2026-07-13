import { describe, expect, it } from "vitest";
import {
  buildMcpConfigJson,
  getMcpProjectPath,
  isMcpConfigComplete,
} from "@/domain/settings/mcp-config";

describe("mcp-config domain", () => {
  describe("getMcpProjectPath", () => {
    it("returns a non-empty string", () => {
      const path = getMcpProjectPath();
      expect(path).toBeTruthy();
      expect(typeof path).toBe("string");
    });
  });

  describe("buildMcpConfigJson", () => {
    it("generates valid config JSON with OAuth URL", () => {
      const result = buildMcpConfigJson({
        workerUrl: "https://noheir.worker.hexly.ai/mcp",
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("mcpServers");
      expect(parsed.mcpServers).toHaveProperty("noheir");
      expect(parsed.mcpServers.noheir.url).toBe("https://noheir.worker.hexly.ai/mcp");
      // Gen 3 uses OAuth - no command, args, or env needed
      expect(parsed.mcpServers.noheir.command).toBeUndefined();
      expect(parsed.mcpServers.noheir.env).toBeUndefined();
    });

    it("produces pretty-printed JSON with 2-space indent", () => {
      const result = buildMcpConfigJson({
        workerUrl: "https://localhost/mcp",
      });
      expect(result).toContain("  ");
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("uses default URL when not provided", () => {
      const result = buildMcpConfigJson({});
      const parsed = JSON.parse(result);
      expect(parsed.mcpServers.noheir.url).toBe("https://noheir.worker.hexly.ai/mcp");
    });
  });

  describe("isMcpConfigComplete", () => {
    it("returns true when URL is filled", () => {
      expect(
        isMcpConfigComplete({
          workerUrl: "https://noheir.worker.hexly.ai/mcp",
        }),
      ).toBe(true);
    });

    it("returns false when params are missing", () => {
      expect(isMcpConfigComplete({})).toBe(false);
    });

    it("returns false when params contain placeholder values", () => {
      expect(
        isMcpConfigComplete({
          workerUrl: "YOUR_WORKER_URL",
        }),
      ).toBe(false);
    });
  });
});
