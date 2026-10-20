import { useLoaderData, useNavigation } from "react-router";
import { AppShell } from "@/components/layout";
import { buildAnalysisFilters } from "@/domain/analyses";
import { financeApi } from "@/lib/finance-api";
import { AnalysesClient } from "./analyses-client";

export async function analysesLoader({ request }: { request: Request }) {
  const [result, preferences] = await Promise.all([
    financeApi.listAnalyses(buildAnalysisFilters(new URL(request.url).searchParams)),
    financeApi.getFinancialPreferences(),
  ]);
  const currentRevision = preferences.meta.dataRevision;
  if (currentRevision === undefined) throw new Error("Missing financial data revision");
  return { result, currentRevision };
}
export default function AnalysesPage() {
  const data = useLoaderData<typeof analysesLoader>();
  const navigation = useNavigation();
  return (
    <AppShell>
      <AnalysesClient {...data} loading={navigation.state !== "idle"} />
    </AppShell>
  );
}
