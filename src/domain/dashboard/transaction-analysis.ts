import type { DomainTransaction, MonthlyData } from "../types";

export type TransactionType = "income" | "expense";

export interface TransactionAnalysisLabels {
  total: string;
  monthly: string;
  count: string;
  trend: string;
  category: string;
  categoryDesc: string;
  account: string;
  accountDesc: string;
  detail: string;
  detailDesc: string;
  top: string;
}

export const buildFilteredTransactions = (
  transactions: DomainTransaction[],
  type: TransactionType,
) => {
  return transactions.filter((t) => t.type === type);
};

export const buildTotalAmount = (transactions: DomainTransaction[]) => {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
};

export const buildTopTransactions = (
  transactions: DomainTransaction[],
  limit = 50,
) => {
  return [...transactions].sort((a, b) => b.amount - a.amount).slice(0, limit);
};

export const buildMonthlyFiltered = (
  monthlyData: MonthlyData[],
  type: TransactionType,
) => {
  return monthlyData.filter((d) =>
    type === "income" ? d.income > 0 : d.expense > 0,
  );
};

export const buildAverageMonthly = (
  monthlyFiltered: MonthlyData[],
  type: TransactionType,
) => {
  if (monthlyFiltered.length === 0) return 0;
  const total = monthlyFiltered.reduce(
    (sum, d) => sum + (type === "income" ? d.income : d.expense),
    0,
  );
  return total / monthlyFiltered.length;
};

export const buildTransactionLabels = (
  type: TransactionType,
): TransactionAnalysisLabels => {
  const isIncome = type === "income";
  return {
    total: isIncome ? "总收入" : "总支出",
    monthly: isIncome ? "月均收入" : "月均支出",
    count: isIncome ? "收入笔数" : "支出笔数",
    trend: isIncome ? "月度收入趋势" : "月度支出趋势",
    category: isIncome ? "收入类别分布" : "支出类别分布",
    categoryDesc: "横向条形图，配合筛选器查看不同层级",
    account: isIncome ? "收款账户分布" : "支付账户分布",
    accountDesc: "Top 10 账户分布",
    detail: isIncome ? "收入明细" : "支出明细",
    detailDesc: isIncome ? "各类别收入详情（点击展开/折叠）" : "各类别支出详情",
    top: isIncome ? "单次收入 Top 50" : "单次支出 Top 50",
  };
};
