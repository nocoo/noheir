/**
 * Products summary aggregation logic.
 *
 * Computes aggregated statistics for financial products including:
 * - Total count (active and archived)
 * - Breakdown by channel, category, currency
 */

import type { FinancialProduct } from "../db/types";

export interface GroupCount {
  [key: string]: number;
}

export interface ProductsSummary {
  total_count: number;
  archived_count: number;
  by_channel: GroupCount;
  by_category: GroupCount;
  by_currency: GroupCount;
}

/**
 * Aggregate products into a summary.
 *
 * @param activeProducts - Non-archived products
 * @param archivedCount - Count of archived products
 */
export function buildProductsSummary(
  activeProducts: FinancialProduct[],
  archivedCount: number
): ProductsSummary {
  const summary: ProductsSummary = {
    total_count: activeProducts.length,
    archived_count: archivedCount,
    by_channel: {},
    by_category: {},
    by_currency: {},
  };

  for (const product of activeProducts) {
    // By channel
    if (product.channel) {
      summary.by_channel[product.channel] = (summary.by_channel[product.channel] ?? 0) + 1;
    }

    // By category
    if (product.category) {
      summary.by_category[product.category] = (summary.by_category[product.category] ?? 0) + 1;
    }

    // By currency
    if (product.currency) {
      summary.by_currency[product.currency] = (summary.by_currency[product.currency] ?? 0) + 1;
    }
  }

  return summary;
}
