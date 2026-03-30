import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { Wallet, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { CategoryDetailList, TopTransactionsTable, MonthlyTrendChart, AccountDistributionChart, CategoryDistributionChart } from './shared';
import { useCategoryData, useAccountData } from '@/hooks/useCategoryData';
import { gridContainer, gridItem } from '@/lib/animations';
import { useTransactionAnalysisViewModel } from '@/viewmodels/dashboard/useTransactionAnalysisViewModel';
import type { TransactionType } from '@/domain/dashboard/transactionAnalysis';

interface TransactionAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
  type: TransactionType;
}

export function TransactionAnalysis({ transactions, monthlyData, type }: TransactionAnalysisProps) {
  const {
    isIncome,
    colorHex,
    colorClass,
    variant,
    icon,
    filteredTransactions,
    totalAmount,
    topTransactions,
    monthlyFiltered,
    avgMonthly,
    labels,
    colors,
  } = useTransactionAnalysisViewModel({ transactions, monthlyData, type });

  const dataKey: 'income' | 'expense' = isIncome ? 'income' : 'expense';

  // Use shared hook for category data
  const categoryData = useCategoryData(filteredTransactions, totalAmount);

  // Use shared hook for account data (always top 10)
  const accountData = useAccountData(filteredTransactions, totalAmount, 10);

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
        dataKey={dataKey}
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
