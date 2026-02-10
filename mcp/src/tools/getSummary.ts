/**
 * getSummary tool handler
 *
 * Returns metadata about the user's financial data:
 * available years, accounts, categories, currencies, tags, and counts.
 * Uses the get_financial_metadata RPC for server-side aggregation,
 * avoiding PostgREST max_rows truncation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SummaryResult {
  years: number[];
  accounts: string[];
  categories: string[];
  secondary_categories: string[];
  tertiary_categories: string[];
  currencies: string[];
  tags: string[];
  transaction_count: number;
  transfer_count: number;
}

export async function getSummary(client: SupabaseClient): Promise<SummaryResult> {
  const { data, error } = await client.rpc("get_financial_metadata");

  if (error) {
    throw new Error(`get_financial_metadata RPC failed: ${error.message}`);
  }

  // RPC returns a JSON object matching SummaryResult shape
  return {
    years: data.years ?? [],
    accounts: data.accounts ?? [],
    categories: data.categories ?? [],
    secondary_categories: data.secondary_categories ?? [],
    tertiary_categories: data.tertiary_categories ?? [],
    currencies: data.currencies ?? [],
    tags: data.tags ?? [],
    transaction_count: data.transaction_count ?? 0,
    transfer_count: data.transfer_count ?? 0,
  };
}
