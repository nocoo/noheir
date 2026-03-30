import type { MonthlyData } from '@/types/transaction';

export interface BalanceWaterfallPoint {
  month: string;
  balance: number;
  cumulative: number;
  start: number;
  isPositive: boolean;
}

export const buildBalanceWaterfallData = (data: MonthlyData[]) => {
  let cumulativeBalance = 0;
  const waterfallData: BalanceWaterfallPoint[] = data.map(item => {
    const prevBalance = cumulativeBalance;
    cumulativeBalance += item.balance;
    return {
      month: item.month,
      balance: item.balance,
      cumulative: cumulativeBalance,
      start: prevBalance,
      isPositive: item.balance >= 0,
    };
  });

  return { waterfallData, cumulativeBalance };
};
