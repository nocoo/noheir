import { Button } from "@nocoo/basalt/components/button";
import { useState } from "react";
import {
  canSelectEnvironment,
  type EnvironmentMode,
  selectInitialEnvironment,
} from "./environment-runtime";

export function EnvironmentStartupError({ message }: { message: string }) {
  const [error, setError] = useState(message);
  const [pending, setPending] = useState(false);
  const start = async (mode: EnvironmentMode) => {
    setPending(true);
    try {
      await selectInitialEnvironment(mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "启动失败");
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="grid min-h-screen place-content-center gap-4 bg-basalt-background p-6 text-basalt-foreground">
      <h1 className="text-xl font-semibold">环境启动失败</h1>
      <p role="alert" className="max-w-lg text-sm">
        {error}
      </p>
      {canSelectEnvironment() && (
        <div className="flex gap-2">
          {(["demo", "e2e", "prod"] as const).map((mode) => (
            <Button key={mode} disabled={pending} onClick={() => start(mode)}>
              {mode === "demo" ? "Demo" : mode === "e2e" ? "E2E" : "Prod"}
            </Button>
          ))}
        </div>
      )}
      <Button variant="outline" onClick={() => window.location.reload()}>
        重新加载
      </Button>
    </main>
  );
}
