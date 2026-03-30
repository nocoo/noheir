import { describe, expect, it } from "bun:test";
import {
  buildMcpConfigJson,
  getMcpProjectPath,
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
    it("generates valid config JSON with worker auth", () => {
      const result = buildMcpConfigJson({
        workerUrl: "https://noheir.worker.hexly.ai",
        workerToken: "test-token",
        userId: "user-123",
        projectPath: "/path/to/project",
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("mcpServers");
      expect(parsed.mcpServers).toHaveProperty("noheir");
      expect(parsed.mcpServers.noheir.command).toBe("bun");
      expect(parsed.mcpServers.noheir.args).toContain("run");
      expect(parsed.mcpServers.noheir.env.WORKER_URL).toBe(
        "https://noheir.worker.hexly.ai",
      );
      expect(parsed.mcpServers.noheir.env.WORKER_TOKEN).toBe("test-token");
      expect(parsed.mcpServers.noheir.env.WORKER_USER_ID).toBe("user-123");
    });

    it("produces pretty-printed JSON with 2-space indent", () => {
      const result = buildMcpConfigJson({
        workerUrl: "https://localhost",
        workerToken: "key",
        userId: "u1",
        projectPath: "/p",
      });
      expect(result).toContain("  ");
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});
