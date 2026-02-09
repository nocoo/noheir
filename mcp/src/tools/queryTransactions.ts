/**
 * queryTransactions tool handler
 *
 * Queries the transactions table via the search_transactions_fuzzy RPC.
 * Accepts a SupabaseClient (already authenticated) and filter params,
 * returns a structured result object.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface QueryTransactionsParams {
  keyword?: string;
  type?: string;
  categories?: string[];
  accounts?: string[];
  tags?: string[];
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  year?: number;
  month?: number;
  currency?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionRow {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  primary_category: string;
  secondary_category: string;
  tertiary_category: string;
  amount: number;
  type: string;
  account: string;
  currency: string;
  tags: string[];
  note: string;
  matched_field: string | null;
}

export interface QueryTransactionsResult {
  transactions: TransactionRow[];
  total_returned: number;
}

export async function queryTransactions(
  client: SupabaseClient,
  params: QueryTransactionsParams,
): Promise<QueryTransactionsResult> {
  const rpcParams: Record<string, unknown> = {};

  if (params.keyword !== undefined) rpcParams.p_keyword = params.keyword;
  if (params.categories !== undefined) rpcParams.p_categories = params.categories;
  if (params.type !== undefined) rpcParams.p_type = params.type;
  if (params.accounts !== undefined) rpcParams.p_accounts = params.accounts;
  if (params.tags !== undefined) rpcParams.p_tags = params.tags;
  if (params.start_date !== undefined) rpcParams.p_start_date = params.start_date;
  if (params.end_date !== undefined) rpcParams.p_end_date = params.end_date;
  if (params.min_amount !== undefined) rpcParams.p_min_amount = params.min_amount;
  if (params.max_amount !== undefined) rpcParams.p_max_amount = params.max_amount;
  if (params.limit !== undefined) rpcParams.p_limit = params.limit;
  if (params.offset !== undefined) rpcParams.p_offset = params.offset;
  if (params.year !== undefined) rpcParams.p_year = params.year;
  if (params.month !== undefined) rpcParams.p_month = params.month;
  if (params.currency !== undefined) rpcParams.p_currency = params.currency;

  const { data, error } = await client.rpc("search_transactions_fuzzy", rpcParams);

  if (error) {
    throw new Error(`search_transactions_fuzzy RPC failed: ${error.message}`);
  }

  const transactions = (data ?? []) as TransactionRow[];

  return {
    transactions,
    total_returned: transactions.length,
  };
}
