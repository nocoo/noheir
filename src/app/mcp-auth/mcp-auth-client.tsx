"use client";

import { useState, useEffect, useMemo } from "react";
import { Shield, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Derive Worker URL from current hostname
// ---------------------------------------------------------------------------

function getWorkerUrl(): string {
  if (typeof window === "undefined") {
    return "https://noheir.worker.hexly.ai";
  }

  const hostname = window.location.hostname;

  // Local development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8788";
  }

  // Production: noheir.hexly.ai -> noheir.worker.hexly.ai
  if (hostname.endsWith(".hexly.ai")) {
    const appName = hostname.replace(".hexly.ai", "");
    return `https://${appName}.worker.hexly.ai`;
  }

  // Fallback to production
  return "https://noheir.worker.hexly.ai";
}

interface McpAuthClientProps {
  state: string;
  clientName: string;
  userId: string;
}

export function McpAuthClient({
  state,
  clientName,
  userId,
}: McpAuthClientProps) {
  const [status, setStatus] = useState<"pending" | "authorizing" | "success" | "error">("pending");
  const [error, setError] = useState<string | null>(null);
  const workerUrl = useMemo(() => getWorkerUrl(), []);

  const handleAuthorize = async () => {
    setStatus("authorizing");
    setError(null);

    try {
      // Call the callback endpoint with user_id
      const callbackUrl = `${workerUrl}/mcp/callback?state=${encodeURIComponent(state)}&user_id=${encodeURIComponent(userId)}`;
      const response = await fetch(callbackUrl, {
        method: "GET",
        redirect: "manual", // Don't follow redirects, we need to handle them
      });

      // The callback should redirect to the client's redirect_uri
      // We check for a redirect response (3xx status)
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl) {
          setStatus("success");
          // Small delay to show success state, then redirect
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1000);
          return;
        }
      }

      // If not a redirect, try to parse error
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error_description || data.error || "授权失败");
      }

      // Unexpected success response
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "授权失败，请重试");
    }
  };

  // Auto-authorize on mount for better UX
  useEffect(() => {
    // Small delay to show the authorization screen
    const timer = setTimeout(() => {
      handleAuthorize();
    }, 500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {status === "success" ? (
              <Check className="h-6 w-6 text-primary" />
            ) : status === "error" ? (
              <AlertCircle className="h-6 w-6 text-destructive" />
            ) : (
              <Shield className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle>
            {status === "success"
              ? "授权成功"
              : status === "error"
                ? "授权失败"
                : "授权请求"}
          </CardTitle>
          <CardDescription>
            {status === "success"
              ? "正在返回客户端..."
              : status === "error"
                ? error
                : `${clientName} 请求访问你的 noheir 数据`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "pending" && (
            <>
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">该应用将能够:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 读取你的交易记录和转账记录</li>
                  <li>• 读取你的理财产品和资金配置</li>
                  <li>• 生成财务报告和数据汇总</li>
                  <li>• 创建和更新理财产品及资金单位</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                你可以随时在 MCP 设置中撤销此授权
              </p>
            </>
          )}

          {status === "authorizing" && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <Check className="mx-auto h-8 w-8 text-green-600" />
                <p className="text-sm text-muted-foreground">正在跳转...</p>
              </div>
            </div>
          )}
        </CardContent>

        {status === "error" && (
          <CardFooter>
            <Button onClick={handleAuthorize} className="w-full">
              重试
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
