import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { CategoryData, PrimaryCategory } from '@/types/category-shared';

/**
 * Hook to process transaction data into category hierarchy
 * Used by both IncomeAnalysis and ExpenseAnalysis
 */
export function useCategoryData(transactions: Transaction[], totalAmount: number): CategoryData {
  return useMemo(() => {
    // Primary -> Secondary -> Tertiary hierarchy
    const primaryMap = new Map<string, {
      total: number;
      secondaryMap: Map<string, {
        total: number;
        tertiaryList: Array<{ name: string; total: number; percentage: number; transactions?: Array<{ date: string; amount: number }> }>;
      }>;
    }>();

    // First pass: aggregate primary and secondary totals
    transactions.forEach(t => {
      if (!primaryMap.has(t.primaryCategory)) {
        primaryMap.set(t.primaryCategory, { total: 0, secondaryMap: new Map() });
      }
      const primary = primaryMap.get(t.primaryCategory)!;
      primary.total += t.amount;

      if (!primary.secondaryMap.has(t.secondaryCategory)) {
        primary.secondaryMap.set(t.secondaryCategory, { total: 0, tertiaryList: [] });
      }
      const secondary = primary.secondaryMap.get(t.secondaryCategory)!;
      secondary.total += t.amount;
    });

    // Second pass: calculate tertiary percentages and group transactions
    transactions.forEach(t => {
      const primary = primaryMap.get(t.primaryCategory);
      if (primary) {
        const secondary = primary.secondaryMap.get(t.secondaryCategory);
        if (secondary) {
          // Find or create tertiary group
          let tertiaryGroup = secondary.tertiaryList.find(grp => grp.name === t.tertiaryCategory);
          if (!tertiaryGroup) {
            tertiaryGroup = {
              name: t.tertiaryCategory,
              total: 0,
              percentage: 0,
              transactions: []
            };
            secondary.tertiaryList.push(tertiaryGroup);
          }
          tertiaryGroup.total += t.amount;
          tertiaryGroup.transactions?.push({
            date: t.date,
            amount: t.amount
          });
        }
      }
    });

    const THRESHOLD = 5; // 5% threshold

    // Process primary categories
    const processedPrimary: PrimaryCategory[] = Array.from(primaryMap.entries()).map(([primary, data]) => ({
      primary,
      total: data.total,
      percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
      secondaryCategories: Array.from(data.secondaryMap.entries())
        .map(([secondary, secData]) => ({
          name: secondary,
          total: secData.total,
          percentage: totalAmount > 0 ? (secData.total / totalAmount) * 100 : 0,
          parent: primary,
          tertiaryList: secData.tertiaryList.sort((a, b) => b.total - a.total)
        }))
        .sort((a, b) => b.total - a.total) // Sort secondary by amount
    })).sort((a, b) => b.total - a.total);

    // Calculate tertiary percentages and sort transactions by date
    processedPrimary.forEach(primary => {
      primary.secondaryCategories.forEach(secondary => {
        secondary.tertiaryList.forEach(tertiary => {
          tertiary.percentage = totalAmount > 0 ? (tertiary.total / totalAmount) * 100 : 0;
          // Sort transactions by date (newest first)
          if (tertiary.transactions) {
            tertiary.transactions.sort((a, b) => b.date.localeCompare(a.date));
          }
        });
      });
    });

    // Group small primary categories into "其他"
    const majorPrimaries = processedPrimary.filter(c => c.percentage >= THRESHOLD);
    const smallPrimaries = processedPrimary.filter(c => c.percentage < THRESHOLD);

    const chartData = [...majorPrimaries];
    if (smallPrimaries.length > 0) {
      const othersTotal = smallPrimaries.reduce((sum, c) => sum + c.total, 0);
      chartData.push({
        primary: '其他',
        total: othersTotal,
        percentage: totalAmount > 0 ? (othersTotal / totalAmount) * 100 : 0,
        secondaryCategories: []
      });
    }

    // Flatten all secondary categories for outer pie
    const allSecondaries = processedPrimary
      .flatMap(p => p.secondaryCategories)
      .filter(s => s.percentage >= THRESHOLD)
      .sort((a, b) => b.total - a.total);

    const majorSecondaries = allSecondaries.filter(s => s.percentage >= THRESHOLD);
    const smallSecondariesTotal = allSecondaries
      .filter(s => s.percentage < THRESHOLD)
      .reduce((sum, s) => sum + s.total, 0);

    const outerPieData = [...majorSecondaries];
    if (smallSecondariesTotal > 0) {
      outerPieData.push({
        name: '其他',
        total: smallSecondariesTotal,
        percentage: totalAmount > 0 ? (smallSecondariesTotal / totalAmount) * 100 : 0,
        parent: ''
      });
    }

    return { chartData, outerPieData, detailList: processedPrimary };
  }, [transactions, totalAmount]);
}

/**
 * Hook to process account distribution data
 */
export function useAccountData(transactions: Transaction[], totalAmount: number, limit?: number) {
  return useMemo(() => {
    const accountMap = new Map<string, number>();
    transactions.forEach(t => {
      accountMap.set(t.account, (accountMap.get(t.account) || 0) + t.amount);
    });

    const sorted = Array.from(accountMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalAmount > 0 ? (value / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    if (limit) {
      // Take top N and group rest as "其他"
      const topN = sorted.slice(0, limit);
      const others = sorted.slice(limit);

      const result = [...topN];
      if (others.length > 0) {
        const othersTotal = others.reduce((sum, acc) => sum + acc.value, 0);
        result.push({
          name: '其他',
          value: othersTotal,
          percentage: totalAmount > 0 ? (othersTotal / totalAmount) * 100 : 0
        });
      }

      return result;
    }

    return sorted;
  }, [transactions, totalAmount, limit]);
}
