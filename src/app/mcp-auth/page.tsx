import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { McpAuthClient } from "./mcp-auth-client";

export const metadata = {
  title: "MCP 授权 - noheir",
  description: "授权 AI 代理访问 noheir 数据",
};

interface McpAuthPageProps {
  searchParams: Promise<{
    state?: string;
    client_name?: string;
  }>;
}

export default async function McpAuthPage({ searchParams }: McpAuthPageProps) {
  const session = await auth();
  const params = await searchParams;

  // If not logged in, redirect to login with return URL
  if (!session?.user) {
    const returnUrl = `/mcp-auth?state=${params.state || ""}&client_name=${encodeURIComponent(params.client_name || "")}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
  }

  // If no state, show error
  if (!params.state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">授权失败</h1>
          <p className="text-muted-foreground">缺少必要的授权参数</p>
        </div>
      </div>
    );
  }

  return (
    <McpAuthClient
      state={params.state}
      clientName={params.client_name || "未知客户端"}
      userId={session.user.id || ""}
    />
  );
}
