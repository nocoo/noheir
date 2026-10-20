import { useLoaderData } from "react-router";
import { financeApi } from "@/lib/finance-api";
import { ApiKeysClient } from "./api-keys-client";

export async function apiKeysLoader() {
  return financeApi.listKeys();
}
export default function ApiKeysPage() {
  const result = useLoaderData<typeof apiKeysLoader>();
  return <ApiKeysClient initialKeys={result.data} />;
}
