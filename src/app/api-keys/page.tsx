import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { financeApi } from "@/lib/finance-api";
import { ApiKeysClient } from "./api-keys-client";

export async function apiKeysLoader() {
  return financeApi.listKeys();
}
export default function ApiKeysPage() {
  const result = useLoaderData<typeof apiKeysLoader>();
  return (
    <AppShell>
      <ApiKeysClient initialKeys={result.data} />
    </AppShell>
  );
}
