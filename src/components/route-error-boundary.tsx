import { Button } from "@nocoo/basalt";
import { AlertCircle, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { AppShell } from "@/components/layout";

export function RouteErrorBoundary() {
  const error = useRouteError();
  let message = "加载财务数据失败，请重试。";

  if (isRouteErrorResponse(error)) {
    message = error.data?.message || `请求失败 (${error.status}): ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <AppShell>
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="size-8" />
        </div>
        <h2 className="mb-2 text-xl font-bold">数据加载失败</h2>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
          <RefreshCw className="size-4" />
          重新加载
        </Button>
      </div>
    </AppShell>
  );
}
