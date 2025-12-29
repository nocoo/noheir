import { useMemo } from 'react';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { TrendingDown, Wallet, Calendar } from 'lucide-react';
import { CategoryDetailList, TopTransactionsTable, MonthlyTrendChart, AccountDistributionChart, CategoryDistributionChart } from './shared';
import { useCategoryData, useAccountData } from '@/hooks/useCategoryData';

interface ExpenseAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function ExpenseAnalysis({ transactions, monthlyData }: ExpenseAnalysisProps) {
  const { settings } = useSettings();
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);

  const expenseTransactions = useMemo(() =>
    transactions.filter(t => t.type === 'expense'),
    [transactions]
  );

  const totalExpense = useMemo(() =>
    expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
    [expenseTransactions]
  );

  // Use shared hook for category data
  const categoryData = useCategoryData(expenseTransactions, totalExpense);

  // Use shared hook for account data (top 20, no grouping)
  const accountData = useAccountData(expenseTransactions, totalExpense);

  // Top 50 expense transactions
  const topExpenseTransactions = useMemo(() =>
    [...expenseTransactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50),
    [expenseTransactions]
  );

  const monthlyExpense = useMemo(() =>
    monthlyData.filter(d => d.expense > 0),
    [monthlyData]
  );

  const avgMonthlyExpense = useMemo(() =>
    monthlyExpense.length > 0
      ? monthlyExpense.reduce((s, d) => s + d.expense, 0) / monthlyExpense.length
      : 0,
    [monthlyExpense]
  );

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  if (expenseTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">暂无支出数据</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="总支出"
          value={totalExpense}
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          title="月均支出"
          value={Math.round(avgMonthlyExpense)}
          icon={Calendar}
          variant="expense"
        />
        <StatCard
          title="支出笔数"
          value={expenseTransactions.length}
          icon={Wallet}
          variant="expense"
          showCurrency={false}
        />
      </div>

      {/* Monthly Trend - Shared Component */}
      <MonthlyTrendChart
        title="月度支出趋势"
        description="每月支出变化趋势"
        monthlyData={monthlyData}
        averageValue={avgMonthlyExpense}
        colorHex={expenseColorHex}
        dataKey="expense"
        icon={TrendingDown}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution - Shared Component */}
        <CategoryDistributionChart
          title="支出类别分布"
          description="横向条形图，配合筛选器查看不同层级"
          detailList={categoryData.detailList}
          colors={colors}
          tooltipColor={expenseColorHex}
        />

        {/* Account Distribution - Shared Component */}
        <AccountDistributionChart
          title="支付账户分布"
          description="Top 20 账户支出情况"
          accountData={accountData}
          colorHex={expenseColorHex}
          layout="horizontal"
        />
      </div>

      {/* Detailed Category List - Shared Component */}
      <CategoryDetailList
        title="支出明细"
        description="各类别支出详情"
        detailList={categoryData.detailList}
        colorHex={expenseColorHex}
        colorClass={expenseColorClass}
        totalAmount={totalExpense}
        colors={colors}
      />

      {/* Top 50 Expense Transactions - Shared Component */}
      <TopTransactionsTable
        title="单次支出 Top 50"
        description="最高的50笔支出记录"
        transactions={topExpenseTransactions}
        variant="expense"
        colorClass={expenseColorClass}
      />
    </div>
  );
}
