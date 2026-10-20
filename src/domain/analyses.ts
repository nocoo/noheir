import { z } from "zod";
import {
  type Analysis,
  analysisSchema,
  apiCurrencySchema,
  apiDateSchema,
} from "@/domain/api-contract";

export interface AnalysisDraft {
  title: string;
  markdown: string;
  externalId: string;
  periodStart: string;
  periodEnd: string;
  currencies: string[];
  dataRevision: string;
  author: string;
  model: string;
  evidence: string;
}
export function createAnalysisDraft(
  report: Analysis | undefined,
  revision: number,
  today: string,
): AnalysisDraft {
  return {
    title: report?.title ?? "",
    markdown: report?.markdown ?? "",
    externalId: report?.externalId ?? "",
    periodStart: report?.periodStart ?? today,
    periodEnd: report?.periodEnd ?? today,
    currencies: report?.currencies ?? ["CNY"],
    dataRevision: String(report?.dataRevision ?? revision),
    author: report?.author ?? "",
    model: report?.model ?? "",
    evidence: JSON.stringify(report?.evidence ?? [], null, 2),
  };
}
export function buildAnalysisInput(draft: AnalysisDraft) {
  if (!draft.dataRevision.trim()) throw new Error("Data revision is required");
  return analysisSchema.parse({
    ...draft,
    dataRevision: Number(draft.dataRevision),
    evidence: JSON.parse(draft.evidence),
    externalId: draft.externalId.trim() || null,
    author: draft.author.trim() || null,
    model: draft.model.trim() || null,
  });
}
const filterSchema = z
  .object({
    q: z.string().max(200).optional(),
    currency: apiCurrencySchema.optional(),
    startDate: apiDateSchema.optional(),
    endDate: apiDateSchema.optional(),
    cursor: z.string().optional(),
  })
  .refine(
    (value) => !value.startDate || !value.endDate || value.startDate <= value.endDate,
    "Invalid period",
  );
export function buildAnalysisFilters(
  params: URLSearchParams,
  changed?: { q: string; currency: string; startDate: string; endDate: string },
) {
  const input: Record<string, string> = {};
  for (const key of ["q", "currency", "startDate", "endDate", "cursor"] as const) {
    const value = (changed ? (key === "cursor" ? "" : changed[key]) : params.get(key))?.trim();
    if (value) input[key] = value;
  }
  const filters = filterSchema.parse(input);
  return new URLSearchParams({ ...filters, limit: "50" } as Record<string, string>);
}
export function reportRevisionState(observed: number, current: number | undefined) {
  if (current === undefined || observed > current) return "unverified";
  return observed === current ? "current" : "changed";
}
export function safeReportUrl(value: string): string {
  if (
    Array.from(value).some((character) => character <= " " || character === "\\") ||
    value.startsWith("//")
  )
    return "";
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) && !url.username && !url.password
      ? value
      : "";
  } catch {
    return "";
  }
}
