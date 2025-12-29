import { useMemo } from 'react';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getIncomeColor, getIncomeColorHex } from '@/contexts/SettingsContext';
import { TrendingUp, Wallet, Calendar } from 'lucide-react';
import { CategoryDetailList, TopTransactionsTable, MonthlyTrendChart, AccountDistributionChart, CategoryDistributionChart } from './shared';
import { useCategoryData, useAccountData } from '@/hooks/useCategoryData';

interface IncomeAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function IncomeAnalysis({ transactions, monthlyData }: IncomeAnalysisProps) {
  const { settings } = useSettings();
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const incomeColorClass = getIncomeColor(settings.colorScheme);

  const incomeTransactions = useMemo(() =>
    transactions.filter(t => t.type === 'income'),
    [transactions]
  );

  const totalIncome = useMemo(() =>
    incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
    [incomeTransactions]
  );

  // Use shared hook for category data
  const categoryData = useCategoryData(incomeTransactions, totalIncome);

  // Use shared hook for account data (top 5)
  const accountData = useAccountData(incomeTransactions, totalIncome, 5);

  // Top 50 income transactions
  const topIncomeTransactions = useMemo(() =>
    [...incomeTransactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50),
    [incomeTransactions]
  );

  const monthlyIncome = useMemo(() =>
    monthlyData.filter(d => d.income > 0),
    [monthlyData]
  );

  const avgMonthlyIncome = useMemo(() =>
    monthlyIncome.length > 0
      ? monthlyIncome.reduce((s, d) => s + d.income, 0) / monthlyIncome.length
      : 0,
    [monthlyIncome]
  );

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  if (incomeTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">暂无收入数据</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="总收入"
          value={totalIncome}
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="月均收入"
          value={Math.round(avgMonthlyIncome)}
          icon={Calendar}
          variant="income"
        />
        <StatCard
          title="收入笔数"
          value={incomeTransactions.length}
          icon={Wallet}
          variant="income"
          showCurrency={false}
        />
      </div>

      {/* Monthly Trend - Shared Component */}
      <MonthlyTrendChart
        title="月度收入趋势"
        description="每月收入变化趋势"
        monthlyData={monthlyData}
        averageValue={avgMonthlyIncome}
        colorHex={incomeColorHex}
        dataKey="income"
        icon={TrendingUp}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution - Shared Component */}
        <CategoryDistributionChart
          title="收入类别分布"
          description="横向条形图，配合筛选器查看不同层级"
          detailList={categoryData.detailList}
          colors={colors}
          tooltipColor={incomeColorHex}
        />

        {/* Account Distribution - Shared Component */}
        <AccountDistributionChart
          title="收款账户分布"
          description="Top 5 账户收入情况"
          accountData={accountData}
          colorHex={incomeColorHex}
          layout="vertical"
        />
      </div>

      {/* Detailed Category List - Shared Component */}
      <CategoryDetailList
        title="收入明细"
        description="各类别收入详情（点击展开/折叠）"
        detailList={categoryData.detailList}
        colorHex={incomeColorHex}
        colorClass={incomeColorClass}
        totalAmount={totalIncome}
        colors={colors}
      />

      {/* Top 50 Income Transactions - Shared Component */}
      <TopTransactionsTable
        title="单次收入 Top 50"
        description="最高的50笔收入记录"
        transactions={topIncomeTransactions}
        variant="income"
        colorClass={incomeColorClass}
      />
    </div>
  );
}
