import { AppShell } from "@/components/layout";
import { McpTokensClient } from "./mcp-tokens-client";

export const metadata = {
  title: "MCP 令牌 - noheir",
  description: "管理 MCP 令牌，连接 AI 代理到个人财务数据",
};

export default function McpTokensPage() {
  const mcpUrl = process.env.WORKER_URL
    ? `${process.env.WORKER_URL}/mcp`
    : "https://noheir.worker.hexly.ai/mcp";

  return (
    <AppShell>
      <McpTokensClient mcpUrl={mcpUrl} />
    </AppShell>
  );
}
