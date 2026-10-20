import { useLoaderData } from "react-router";
import type { FinancialPreferences } from "@/domain/api-contract";
import { financeApi } from "@/lib/finance-api";
import { SettingsClient } from "./settings-client";

export interface SettingsLoaderData {
  preferences: FinancialPreferences;
}

export async function settingsLoader(): Promise<SettingsLoaderData> {
  const { data: preferences } = await financeApi.getFinancialPreferences();
  return { preferences };
}

export default function SettingsPage() {
  const { preferences } = useLoaderData<SettingsLoaderData>();

  return <SettingsClient preferences={preferences} />;
}
