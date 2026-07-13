/**
 * Server-side builders for category and account data aggregation.
 * Replaces the Gen 1 useCategoryData / useAccountData hooks.
 */

import type {
  AccountChartData,
  CategoryGroup,
  PrimaryCategoryGroup,
  SecondaryCategory,
  TertiaryCategory,
} from "@/components/shared";
import type { DomainTransaction } from "@/domain/types";

const THRESHOLD = 5; // 5% threshold for "other" grouping

/** Build hierarchical category data from transactions */
export function buildCategoryData(
  transactions: DomainTransaction[],
  totalAmount: number,
): {
  chartData: CategoryGroup[];
  detailList: PrimaryCategoryGroup[];
} {
  // Primary → Secondary → Tertiary hierarchy
  const primaryMap = new Map<
    string,
    {
      total: number;
      secondaryMap: Map<
        string,
        {
          total: number;
          tertiaryMap: Map<string, { total: number; txs: Array<{ date: string; amount: number }> }>;
        }
      >;
    }
  >();

  for (const t of transactions) {
    let primary = primaryMap.get(t.primaryCategory);
    if (!primary) {
      primary = { total: 0, secondaryMap: new Map() };
      primaryMap.set(t.primaryCategory, primary);
    }
    primary.total += t.amount;

    const secKey = t.secondaryCategory ?? "";
    let secondary = primary.secondaryMap.get(secKey);
    if (!secondary) {
      secondary = { total: 0, tertiaryMap: new Map() };
      primary.secondaryMap.set(secKey, secondary);
    }
    secondary.total += t.amount;

    let tertiary = secondary.tertiaryMap.get(t.tertiaryCategory);
    if (!tertiary) {
      tertiary = { total: 0, txs: [] };
      secondary.tertiaryMap.set(t.tertiaryCategory, tertiary);
    }
    tertiary.total += t.amount;
    tertiary.txs.push({ date: t.date, amount: t.amount });
  }

  // Build PrimaryCategoryGroup[]
  const processedPrimary: PrimaryCategoryGroup[] = Array.from(primaryMap.entries())
    .map(([primary, data]) => {
      const secondaryCategories: SecondaryCategory[] = Array.from(data.secondaryMap.entries())
        .map(([secName, secData]) => {
          const tertiaryList: TertiaryCategory[] = Array.from(secData.tertiaryMap.entries())
            .map(([name, td]) => ({
              name,
              total: td.total,
              transactions: td.txs.sort((a, b) => b.date.localeCompare(a.date)),
            }))
            .sort((a, b) => b.total - a.total);

          return {
            name: secName,
            total: secData.total,
            tertiaryList,
          };
        })
        .sort((a, b) => b.total - a.total);

      return {
        primary,
        total: data.total,
        percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
        secondaryCategories,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Chart data: group small primaries into "其他"
  const majorPrimaries = processedPrimary.filter((c) => c.percentage >= THRESHOLD);
  const smallPrimaries = processedPrimary.filter((c) => c.percentage < THRESHOLD);

  const chartData: CategoryGroup[] = majorPrimaries.map((p) => ({
    primary: p.primary,
    total: p.total,
    percentage: p.percentage,
    secondaryCategories: p.secondaryCategories.map((s) => ({
      name: s.name,
      total: s.total,
    })),
  }));

  if (smallPrimaries.length > 0) {
    const othersTotal = smallPrimaries.reduce((sum, c) => sum + c.total, 0);
    chartData.push({
      primary: "其他",
      total: othersTotal,
      percentage: totalAmount > 0 ? (othersTotal / totalAmount) * 100 : 0,
      secondaryCategories: [],
    });
  }

  return { chartData, detailList: processedPrimary };
}

/** Build account distribution data from transactions */
export function buildAccountData(
  transactions: DomainTransaction[],
  totalAmount: number,
  limit = 10,
): AccountChartData[] {
  const accountMap = new Map<string, number>();
  for (const t of transactions) {
    accountMap.set(t.account, (accountMap.get(t.account) ?? 0) + t.amount);
  }

  const sorted: AccountChartData[] = Array.from(accountMap.entries())
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalAmount > 0 ? (value / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const topN = sorted.slice(0, limit);
  const others = sorted.slice(limit);

  if (others.length > 0) {
    const othersTotal = others.reduce((sum, acc) => sum + acc.value, 0);
    topN.push({
      name: "其他",
      value: othersTotal,
      percentage: totalAmount > 0 ? (othersTotal / totalAmount) * 100 : 0,
    });
  }

  return topN;
}
