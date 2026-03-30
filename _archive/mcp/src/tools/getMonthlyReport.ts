/**
 * getMonthlyReport tool handler
 *
 * Returns aggregated monthly financial data via the get_monthly_report RPC:
 * income/expense totals, net amount, transfer flows, category breakdowns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface GetMonthlyReportParams {
  year: number;
  month: number;
  currency?: string;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

export interface MonthlyReportResult {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
  net_amount: number;
  transaction_count: number;
  transfer_count: number;
  total_transfer_in: number;
  total_transfer_out: number;
  expense_by_category: CategoryBreakdown[];
  income_by_category: CategoryBreakdown[];
  currencies: string[];
}

export async function getMonthlyReport(
  client: SupabaseClient,
  params: GetMonthlyReportParams,
): Promise<MonthlyReportResult> {
  const rpcParams: Record<string, unknown> = {
    p_year: params.year,
    p_month: params.month,
  };

  if (params.currency !== undefined) {
    rpcParams.p_currency = params.currency;
  }

  const { data, error } = await client.rpc("get_monthly_report", rpcParams);

  if (error) {
    throw new Error(`get_monthly_report RPC failed: ${error.message}`);
  }

  return {
    year: data.year ?? params.year,
    month: data.month ?? params.month,
    total_income: data.total_income ?? 0,
    total_expense: data.total_expense ?? 0,
    net_amount: data.net_amount ?? 0,
    transaction_count: data.transaction_count ?? 0,
    transfer_count: data.transfer_count ?? 0,
    total_transfer_in: data.total_transfer_in ?? 0,
    total_transfer_out: data.total_transfer_out ?? 0,
    expense_by_category: data.expense_by_category ?? [],
    income_by_category: data.income_by_category ?? [],
    currencies: data.currencies ?? [],
  };
}
