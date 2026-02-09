/**
 * getSummary tool handler
 *
 * Returns metadata about the user's financial data:
 * available years, accounts, categories, currencies, tags, and counts.
 * Uses Supabase query builder (SELECT DISTINCT) — no RPC needed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SummaryResult {
  years: number[];
  accounts: string[];
  categories: string[];
  currencies: string[];
  tags: string[];
  transaction_count: number;
  transfer_count: number;
}

export async function getSummary(client: SupabaseClient): Promise<SummaryResult> {
  // Run all queries in parallel for performance
  const [
    txYears,
    tfYears,
    txAccounts,
    tfAccounts,
    txCategories,
    txCurrencies,
    tfCurrencies,
    txTags,
    tfTags,
    txCount,
    tfCount,
  ] = await Promise.all([
    // Years from transactions
    client.from("transactions").select("year"),
    // Years from transfers
    client.from("transfers").select("year"),
    // Accounts from transactions
    client.from("transactions").select("account"),
    // Accounts from transfers
    client.from("transfers").select("account"),
    // Categories from transactions
    client.from("transactions").select("primary_category"),
    // Currencies from transactions
    client.from("transactions").select("currency"),
    // Currencies from transfers
    client.from("transfers").select("currency"),
    // Tags from transactions
    client.from("transactions").select("tags"),
    // Tags from transfers
    client.from("transfers").select("tags"),
    // Count transactions
    client.from("transactions").select("id", { count: "exact", head: true }),
    // Count transfers
    client.from("transfers").select("id", { count: "exact", head: true }),
  ]);

  // Deduplicate years
  const yearsSet = new Set<number>();
  for (const row of txYears.data ?? []) yearsSet.add(row.year);
  for (const row of tfYears.data ?? []) yearsSet.add(row.year);

  // Deduplicate accounts
  const accountsSet = new Set<string>();
  for (const row of txAccounts.data ?? []) accountsSet.add(row.account);
  for (const row of tfAccounts.data ?? []) accountsSet.add(row.account);

  // Deduplicate categories (transactions only)
  const categoriesSet = new Set<string>();
  for (const row of txCategories.data ?? []) categoriesSet.add(row.primary_category);

  // Deduplicate currencies
  const currenciesSet = new Set<string>();
  for (const row of txCurrencies.data ?? []) currenciesSet.add(row.currency);
  for (const row of tfCurrencies.data ?? []) currenciesSet.add(row.currency);

  // Deduplicate tags (unnest arrays)
  const tagsSet = new Set<string>();
  for (const row of txTags.data ?? []) {
    if (Array.isArray(row.tags)) {
      for (const tag of row.tags) tagsSet.add(tag);
    }
  }
  for (const row of tfTags.data ?? []) {
    if (Array.isArray(row.tags)) {
      for (const tag of row.tags) tagsSet.add(tag);
    }
  }

  return {
    years: [...yearsSet].sort((a, b) => b - a),
    accounts: [...accountsSet].sort(),
    categories: [...categoriesSet].sort(),
    currencies: [...currenciesSet].sort(),
    tags: [...tagsSet].sort(),
    transaction_count: txCount.count ?? 0,
    transfer_count: tfCount.count ?? 0,
  };
}
