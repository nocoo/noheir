import { useMemo } from 'react';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { CategoryDetailList, TopTransactionsTable, MonthlyTrendChart, AccountDistributionChart, CategoryDistributionChart } from './shared';
import { useCategoryData, useAccountData } from '@/hooks/useCategoryData';
import { gridContainer, gridItem } from '@/lib/animations';

type TransactionType = 'income' | 'expense';

interface TransactionAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
  type: TransactionType;
}

export function TransactionAnalysis({ transactions, monthlyData, type }: TransactionAnalysisProps) {
  const { settings } = useSettings();
  const isIncome = type === 'income';

  // Select colors based on type
  const colorHex = isIncome ? getIncomeColorHex(settings.colorScheme) : getExpenseColorHex(settings.colorScheme);
  const colorClass = isIncome ? getIncomeColor(settings.colorScheme) : getExpenseColor(settings.colorScheme);
  const variant = isIncome ? 'income' : 'expense' as const;
  const icon = isIncome ? TrendingUp : TrendingDown;

  // Filter transactions by type
  const filteredTransactions = useMemo(() =>
    transactions.filter(t => t.type === type),
    [transactions, type]
  );

  // Calculate totals
  const totalAmount = useMemo(() =>
    filteredTransactions.reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  // Use shared hook for category data
  const categoryData = useCategoryData(filteredTransactions, totalAmount);

  // Use shared hook for account data (always top 10)
  const accountData = useAccountData(filteredTransactions, totalAmount, 10);

  // Top 50 transactions
  const topTransactions = useMemo(() =>
    [...filteredTransactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50),
    [filteredTransactions]
  );

  const monthlyFiltered = useMemo(() =>
    monthlyData.filter(d => (isIncome ? d.income : d.expense) > 0),
    [monthlyData, isIncome]
  );

  const avgMonthly = useMemo(() =>
    monthlyFiltered.length > 0
      ? monthlyFiltered.reduce((s, d) => s + (isIncome ? d.income : d.expense), 0) / monthlyFiltered.length
      : 0,
    [monthlyFiltered, isIncome]
  );

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  // Dynamic labels based on type
  const labels = {
    total: isIncome ? '总收入' : '总支出',
    monthly: isIncome ? '月均收入' : '月均支出',
    count: isIncome ? '收入笔数' : '支出笔数',
    trend: isIncome ? '月度收入趋势' : '月度支出趋势',
    trendDesc: isIncome ? '每月收入变化趋势' : '每月支出变化趋势',
    category: isIncome ? '收入类别分布' : '支出类别分布',
    categoryDesc: '横向条形图，配合筛选器查看不同层级',
    account: isIncome ? '收款账户分布' : '支付账户分布',
    accountDesc: 'Top 10 账户分布',
    detail: isIncome ? '收入明细' : '支出明细',
    detailDesc: isIncome ? '各类别收入详情（点击展开/折叠）' : '各类别支出详情',
    top: isIncome ? '单次收入 Top 50' : '单次支出 Top 50',
    topDesc: isIncome ? '最高的50笔收入记录' : '最高的50笔支出记录',
  };

  if (filteredTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无{isIncome ? '收入' : '支出'}数据
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <motion.div
        variants={gridContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <motion.div variants={gridItem}>
          <StatCard
            title={labels.total}
            value={totalAmount}
            icon={icon}
            variant={variant}
          />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard
            title={labels.monthly}
            value={Math.round(avgMonthly)}
            icon={Calendar}
            variant={variant}
          />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard
            title={labels.count}
            value={filteredTransactions.length}
            icon={Wallet}
            variant={variant}
            showCurrency={false}
          />
        </motion.div>
      </motion.div>

      {/* Monthly Trend - Shared Component */}
      <MonthlyTrendChart
        title={labels.trend}
        description={labels.trendDesc}
        monthlyData={monthlyData}
        averageValue={avgMonthly}
        colorHex={colorHex}
        dataKey={isIncome ? 'income' : 'expense'}
        icon={icon}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution - Shared Component */}
        <CategoryDistributionChart
          title={labels.category}
          description={labels.categoryDesc}
          detailList={categoryData.detailList}
          colors={colors}
          tooltipColor={colorHex}
        />

        {/* Account Distribution - Shared Component */}
        <AccountDistributionChart
          title={labels.account}
          description={labels.accountDesc}
          accountData={accountData}
          colorHex={colorHex}
          layout="vertical"
        />
      </div>

      {/* Detailed Category List - Shared Component */}
      <CategoryDetailList
        title={labels.detail}
        description={labels.detailDesc}
        detailList={categoryData.detailList}
        colorHex={colorHex}
        colorClass={colorClass}
        totalAmount={totalAmount}
        colors={colors}
      />

      {/* Top 50 Transactions - Shared Component */}
      <TopTransactionsTable
        title={labels.top}
        description={labels.topDesc}
        transactions={topTransactions}
        variant={variant}
        colorClass={colorClass}
      />
    </div>
  );
}
