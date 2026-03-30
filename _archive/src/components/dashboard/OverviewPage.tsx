import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, PiggyBank, Percent } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionHeatmap } from '@/components/dashboard/TransactionHeatmap';
import { IncomeExpenseComparison } from '@/components/dashboard/IncomeExpenseComparison';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { UnifiedYearSelector } from '@/components/dashboard/UnifiedYearSelector';
import { fadeInUp, gridContainer, gridItem } from '@/lib/animations';
import { useOverviewViewModel } from '@/viewmodels/dashboard/useOverviewViewModel';
import type { Transaction } from '@/types/transaction';

interface OverviewPageProps {
  transactions: Transaction[];
  monthlyData: { month: string; income: number; expense: number; balance: number }[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
  selectedYear: number | null;
  availableYears: number[];
  onYearChange: (year: number | null) => void;
  targetSavingsRate: number;
}

export function OverviewPage({
  transactions,
  monthlyData,
  totalIncome,
  totalExpense,
  balance,
  selectedYear,
  availableYears,
  onYearChange,
  targetSavingsRate,
}: OverviewPageProps) {
  const {
    savingsRate,
  } = useOverviewViewModel({
    transactions,
    monthlyData,
    totalIncome,
    totalExpense,
    balance,
    selectedYear,
    availableYears,
    onYearChange,
    targetSavingsRate,
  });

  return (
    <motion.div
      key="overview"
      initial="initial"
      animate="animate"
      variants={fadeInUp}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">财务概览</h1>
          <p className="text-muted-foreground">查看您的财务状况和趋势</p>
        </div>
        <UnifiedYearSelector mode="single" selectedYear={selectedYear} availableYears={availableYears} onChange={onYearChange} />
      </div>

      <motion.div
        variants={gridContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={gridItem}>
          <StatCard title="总收入" value={totalIncome} icon={TrendingUp} variant="income" />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard title="总支出" value={totalExpense} icon={TrendingDown} variant="expense" />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard title="结余" value={balance} icon={PiggyBank} variant="balance" />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard
            title="储蓄率"
            value={`${savingsRate.toFixed(1)}%`}
            icon={Percent}
            variant="savings"
            savingsValue={savingsRate}
            targetSavingsRate={targetSavingsRate}
          />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionHeatmap transactions={transactions} year={selectedYear} type="expense" />
        <TransactionHeatmap transactions={transactions} year={selectedYear} type="income" />
      </div>

      <IncomeExpenseComparison data={monthlyData} />

      <TransactionTable transactions={transactions} />
    </motion.div>
  );
}
