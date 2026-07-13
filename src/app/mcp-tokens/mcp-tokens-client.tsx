"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { KeyRound, Copy, Check, Terminal, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Derive MCP URL from current hostname
// MCP endpoint is proxied at /api/mcp on the main domain
// ---------------------------------------------------------------------------

function getMcpUrl(): string {
  if (typeof window === "undefined") {
    return "https://noheir.hexly.ai/api/mcp";
  }

  const { protocol, hostname, port } = window.location;
  let baseUrl = `${protocol}//${hostname}`;
  if (port && port !== "80" && port !== "443") {
    baseUrl += `:${port}`;
  }

  return `${baseUrl}/api/mcp`;
}

// ---------------------------------------------------------------------------
// Copy button (reusable)
// ---------------------------------------------------------------------------

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        className,
      )}
      title="复制"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="group relative rounded-lg bg-secondary border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {lang ?? "config"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function McpTokensClient() {
  const [activeTab, setActiveTab] = useState<"claude-code" | "claude-desktop" | "cursor">(
    "claude-code",
  );
  const mcpUrl = useMemo(() => getMcpUrl(), []);

  // Config templates for different clients
  const configs = {
    "claude-code": `{
  "mcpServers": {
    "noheir": {
      "type": "http",
      "url": "${mcpUrl}"
    }
  }
}`,
    "claude-desktop": `{
  "mcpServers": {
    "noheir": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${mcpUrl}"
      ]
    }
  }
}`,
    cursor: `{
  "mcpServers": {
    "noheir": {
      "type": "http",
      "url": "${mcpUrl}"
    }
  }
}`,
  };

  const tabs = [
    { key: "claude-code" as const, label: "Claude Code" },
    { key: "claude-desktop" as const, label: "Claude Desktop" },
    { key: "cursor" as const, label: "Cursor" },
  ];

  const configPaths = {
    "claude-code": "~/.claude.json 或项目根目录 .mcp.json",
    "claude-desktop": "~/Library/Application Support/Claude/claude_desktop_config.json",
    cursor: "~/.cursor/mcp.json",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <KeyRound className="text-primary size-6" />
          MCP 配置
        </h1>
        <p className="text-muted-foreground text-sm">
          连接 AI 代理到 noheir，通过 MCP 协议访问个人财务数据
        </p>
      </div>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4" />
            配置指南
          </CardTitle>
          <CardDescription>
            将以下配置添加到 AI 客户端，即可通过 MCP 协议访问 noheir 数据
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MCP Endpoint */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">MCP 端点</div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
              <code className="flex-1 text-xs font-mono text-foreground break-all">{mcpUrl}</code>
              <CopyButton text={mcpUrl} />
            </div>
          </div>

          {/* Steps */}
          <ol className="space-y-1 text-sm text-muted-foreground leading-relaxed list-decimal list-inside">
            <li>选择你使用的 AI 客户端</li>
            <li>复制下方配置到对应的配置文件</li>
            <li>重启 AI 客户端</li>
            <li>首次使用时会弹出登录窗口，使用 noheir 账号登录即可</li>
          </ol>

          {/* Config tabs */}
          <div className="space-y-2">
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-0.5 w-fit">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    activeTab === key
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Config path hint */}
            <p className="text-xs text-muted-foreground">
              配置文件路径:{" "}
              <code className="bg-secondary px-1 py-0.5 rounded">{configPaths[activeTab]}</code>
            </p>

            <CodeBlock code={configs[activeTab]} lang="json" />
          </div>

          {/* OAuth explanation */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">关于认证</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              noheir 使用 OAuth 2.1 协议进行认证。首次连接时，AI 客户端会自动打开浏览器窗口，
              引导你登录 noheir 账号并授权。授权后，AI 代理即可安全地访问你的财务数据。
              令牌会自动刷新，无需手动管理。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">可用工具</CardTitle>
          <CardDescription>
            MCP 服务器提供以下工具，AI 代理可用于查询和管理你的财务数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <ToolCard
              title="查询工具"
              tools={[
                "get_summary - 获取财务数据摘要",
                "query_transactions - 查询收支记录",
                "query_transfers - 查询转账记录",
                "get_monthly_report - 获取月度报告",
              ]}
            />
            <ToolCard
              title="产品管理"
              tools={[
                "list_products - 列出理财产品",
                "get_product - 获取产品详情",
                "create_product - 创建产品",
                "update_product - 更新产品",
              ]}
            />
            <ToolCard
              title="资金管理"
              tools={[
                "list_units - 列出资金单位",
                "get_unit - 获取资金详情",
                "create_unit - 创建资金单位",
                "update_unit - 更新资金单位",
              ]}
            />
            <ToolCard
              title="汇总工具"
              tools={[
                "get_products_summary - 产品统计汇总",
                "get_units_summary - 资金统计汇总",
                "delete_product - 归档产品",
                "delete_unit - 删除资金单位",
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Help link */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" asChild>
          <a
            href="https://modelcontextprotocol.io/quickstart/user"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground"
          >
            <ExternalLink className="mr-2 size-4" />
            了解更多关于 MCP 协议
          </a>
        </Button>
      </div>
    </div>
  );
}

function ToolCard({ title, tools }: { title: string; tools: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-1">
        {tools.map((tool) => (
          <li key={tool} className="text-xs text-muted-foreground font-mono">
            {tool}
          </li>
        ))}
      </ul>
    </div>
  );
}
