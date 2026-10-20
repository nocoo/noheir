import { z } from "zod";

export const API_RESOURCES = [
  "transactions",
  "transfers",
  "products",
  "units",
  "contribution-logs",
  "expense-categories",
  "recurring-expenses",
  "account-classifications",
  "balance-anchors",
  "financial-preferences",
  "analyses",
] as const;
export type ApiResource = (typeof API_RESOURCES)[number];
export const API_SCOPES = [
  ...API_RESOURCES.flatMap((resource) =>
    (["read", "write", "delete"] as const).map((action) => `${resource}:${action}` as const),
  ),
  "units:commit",
  "audit:read",
  "data:replace",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];
export const apiScopeSchema = z.enum(API_SCOPES);
export const apiKeyCreateSchema = z.strictObject({
  label: z.string().trim().min(1).max(100),
  scopes: z
    .array(apiScopeSchema)
    .min(1)
    .max(API_SCOPES.length)
    .refine((values) => new Set(values).size === values.length, "Duplicate scopes"),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});
export type ApiKeyCreate = z.input<typeof apiKeyCreateSchema>;
export interface ApiKeyInfo {
  id: string;
  label: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}
export interface ApiEnvelope<T> {
  data: T;
  meta: {
    requestId: string;
    dataRevision?: number;
    auditRevision?: number;
    returned?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
    asOf?: string;
    total?: number;
    filters?: Record<string, unknown>;
  };
}
export interface ApiMutation {
  id: string;
  version: number;
  affected: number;
}
export interface VersionedResource {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export const apiDateSchema = z.iso.date();
export const apiCurrencySchema = z.enum(["CNY", "USD", "HKD"]);
export const apiCentsSchema = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const names = z.array(z.string().trim().min(1).max(200)).max(500);
export const financialPreferencesSchema = z
  .strictObject({
    savingsRateTarget: z.number().min(0).max(100).default(30),
    expectedReturnRate: z.number().min(-100).max(100).default(4),
    minReturnRate: z.number().min(-100).max(100).default(2),
    maxReturnRate: z.number().min(-100).max(100).default(8),
    activeIncomeCategories: names.default([]),
    fixedExpenseCategories: names.default([]),
  })
  .refine((data) => data.minReturnRate <= data.maxReturnRate, "Invalid return-rate interval");
export type FinancialPreferencesInput = z.input<typeof financialPreferencesSchema>;
export type FinancialPreferences = z.output<typeof financialPreferencesSchema> & VersionedResource;
export const accountClassificationSchema = z.strictObject({
  accountName: z.string().trim().min(1).max(200),
  type: z.enum(["debit", "credit", "prepaid", "financial", "unclassified"]),
});
export type AccountClassificationInput = z.input<typeof accountClassificationSchema>;
export type AccountClassification = AccountClassificationInput & VersionedResource;
export const balanceAnchorSchema = z.strictObject({
  accountName: z.string().trim().min(1).max(200),
  currency: apiCurrencySchema,
  date: apiDateSchema,
  balanceCents: apiCentsSchema,
});
export type BalanceAnchorInput = z.input<typeof balanceAnchorSchema>;
export type BalanceAnchorResource = BalanceAnchorInput & VersionedResource;
export const analysisSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    markdown: z.string().max(100_000),
    externalId: z.string().trim().min(1).max(200).nullable().optional(),
    periodStart: apiDateSchema,
    periodEnd: apiDateSchema,
    currencies: z.array(apiCurrencySchema).min(1).max(3),
    dataRevision: z.number().int().nonnegative(),
    author: z.string().trim().min(1).max(200).nullable().optional(),
    model: z.string().trim().min(1).max(200).nullable().optional(),
    evidence: z
      .array(
        z.strictObject({
          resource: z.enum(API_RESOURCES),
          ids: z.array(z.string().min(1).max(200)).max(500).default([]),
          dataRevision: z.number().int().nonnegative(),
        }),
      )
      .max(100)
      .default([]),
  })
  .refine((data) => data.periodEnd >= data.periodStart, "Invalid report period");
export type AnalysisInput = z.input<typeof analysisSchema>;
export type Analysis = z.output<typeof analysisSchema> &
  VersionedResource & {
    createdBy: { kind: "human" | "apiKey"; keyId: string | null };
  };
