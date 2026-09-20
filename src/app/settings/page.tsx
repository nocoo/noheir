import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { workerDbClient } from "@/lib/worker-db-client";
import { SettingsClient } from "./settings-client";

export interface SettingsLoaderData {
  settingsJson: Record<string, unknown>;
}

export async function settingsLoader(): Promise<SettingsLoaderData> {
  const result = await workerDbClient.getSettings();
  const row = (result.settings as Record<string, unknown>) ?? {};
  const rawJson = typeof row.settings === "string" ? row.settings : "{}";
  const settingsJson = JSON.parse(rawJson) as Record<string, unknown>;

  return { settingsJson };
}

export default function SettingsPage() {
  const { settingsJson } = useLoaderData<SettingsLoaderData>();

  return (
    <AppShell>
      <SettingsClient settingsJson={settingsJson} />
    </AppShell>
  );
}
