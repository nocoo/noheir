import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { AppShell } from "@/components/layout";
import { financeApi } from "@/lib/finance-api";
import { AnalysisDetail } from "./analysis-detail";

export async function analysisLoader({ params }: { params: { id?: string } }) {
  if (!params.id) throw new Error("Missing report ID");
  const [result, preferences] = await Promise.all([
    financeApi.getAnalysis(params.id),
    financeApi.getFinancialPreferences(),
  ]);
  const currentRevision = preferences.meta.dataRevision;
  if (currentRevision === undefined) throw new Error("Missing financial data revision");
  return { report: result.data, currentRevision };
}
export default function AnalysisPage() {
  const data = useLoaderData<typeof analysisLoader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  return (
    <AppShell>
      <AnalysisDetail
        key={`${data.report.id}-${data.report.version}`}
        {...data}
        onDeleted={() => navigate("/analyses")}
        onSaved={() => revalidator.revalidate()}
      />
    </AppShell>
  );
}
