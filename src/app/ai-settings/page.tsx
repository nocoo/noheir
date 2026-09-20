import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { workerDbClient } from "@/lib/worker-db-client";
import { AiSettingsClient } from "./ai-settings-client";

export interface AiSettingsLoaderData {
  aiConfig: Record<string, unknown>;
  mcpParams: { workerUrl: string };
}

export async function aiSettingsLoader(): Promise<AiSettingsLoaderData> {
  const result = await workerDbClient.getSettings();
  const row = (result.settings as Record<string, unknown>) ?? {};
  const rawJson = typeof row.settings === "string" ? row.settings : "{}";
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  const aiConfig = (parsed.ai_config as Record<string, unknown>) ?? {};

  const mcpParams = {
    workerUrl: `${window.location.origin}/api/mcp`,
  };

  return { aiConfig, mcpParams };
}

export default function AiSettingsPage() {
  const { aiConfig, mcpParams } = useLoaderData<AiSettingsLoaderData>();

  return (
    <AppShell>
      <AiSettingsClient aiConfig={aiConfig} mcpParams={mcpParams} />
    </AppShell>
  );
}
