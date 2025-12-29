import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { DataImport } from '@/components/dashboard/DataImport';
import { DataQuality } from '@/components/dashboard/DataQuality';
import { DataManagement } from '@/components/dashboard/DataManagement';
import { IncomeAnalysis } from '@/components/dashboard/IncomeAnalysis';
import { ExpenseAnalysis } from '@/components/dashboard/ExpenseAnalysis';
import { AccountAnalysis } from '@/components/dashboard/AccountAnalysis';
import { Settings } from '@/components/dashboard/Settings';
import { SankeyChart } from '@/components/dashboard/SankeyChart';
import { YearSelector } from '@/components/dashboard/YearSelector';
import { IncomeExpenseComparison } from '@/components/dashboard/IncomeExpenseComparison';
import { SavingsRateChart } from '@/components/dashboard/SavingsRateChart';
import { BalanceWaterfall } from '@/components/dashboard/BalanceWaterfall';
import { FinancialHealthScore } from '@/components/dashboard/FinancialHealthScore';
import { YearComparisonChart } from '@/components/dashboard/YearComparisonChart';
import { MultiYearSelector } from '@/components/dashboard/MultiYearSelector';
import { useTransactions } from '@/hooks/useTransactions';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Percent, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const [activeTab, setActiveTab] = useState('manage');
  const [qualityViewYear, setQualityViewYear] = useState<number | null>(null);
  const [qualityData, setQualityData] = useState<{ year: number; metrics: any; validations: any[] } | null>(null);

  const {
    transactions,
    allTransactions,
    monthlyData,
    categoryData,
    yearlyComparison,
    totalIncome,
    totalExpense,
    balance,
    selectedYear,
    setSelectedYear,
    comparisonYears,
    setComparisonYears,
    availableYears,
    loadFromFile,
    deleteYearData,
    clearAll,
    exportData,
    storedYearsData,
    isLoading,
    getQualityForYear,
    isValidating,
    validationResults,
    qualityMetrics,
  } = useTransactions();

  const savingsRate = useMemo(() => {
    return totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  }, [totalIncome, totalExpense]);

  // Handle load file with auto-show quality
  const handleLoadFile = async (file: File) => {
    const result = await loadFromFile(file);
    if (result.success && qualityMetrics) {
      // Switch to quality view after successful import
      setActiveTab('import');
    }
    return result;
  };

  // Handle view quality for a specific year
  const handleViewQuality = async (year: number) => {
    if (year === 0) {
      setQualityViewYear(null);
      setQualityData(null);
    } else {
      setQualityViewYear(year);
      const data = await getQualityForYear(year);
      setQualityData(data);
    }
  };

  // Handle go to import
  const handleGoToImport = () => {
    setActiveTab('import');
  };

  const previousYearCategoryData = useMemo(() => {
    const prevYear = selectedYear - 1;
    const prevYearTransactions = allTransactions.filter(t => t.year === prevYear && t.type === 'expense');
    const totalExpense = prevYearTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const categoryMap = new Map<string, number>();
    prevYearTransactions.forEach(t => {
      categoryMap.set(t.primaryCategory, (categoryMap.get(t.primaryCategory) || 0) + t.amount);
    });

    return Array.from(categoryMap.entries()).map(([category, total]) => ({
      category,
      total,
      percentage: totalExpense > 0 ? (total / totalExpense) * 100 : 0,
      subcategories: []
    }));
  }, [allTransactions, selectedYear]);

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">数据导入</h1>
            <p className="text-muted-foreground">上传交易数据文件开始分析</p>
          </div>
          <DataImport
            isLoading={isValidating}
            onLoadFile={handleLoadFile}
          />

          {/* Show quality after import */}
          {qualityMetrics && qualityMetrics.totalRecords > 0 && (
            <>
              <div>
                <h2 className="text-xl font-semibold mt-8">数据质量评估</h2>
                <p className="text-muted-foreground text-sm">刚刚导入的数据质量检查结果</p>
              </div>
              <DataQuality
                metrics={qualityMetrics}
                validations={validationResults}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">数据质量评估</h1>
            <p className="text-muted-foreground">检查数据完整性和有效性</p>
          </div>
          <DataQuality
            metrics={qualityMetrics}
            validations={validationResults}
          />
        </div>
      )}

      {activeTab === 'manage' && (
        <DataManagement
          storedYearsData={storedYearsData}
          isLoading={isLoading}
          onDeleteYear={deleteYearData}
          onClearAll={clearAll}
          onExport={exportData}
          onGoToImport={handleGoToImport}
          onViewQuality={handleViewQuality}
          qualityData={qualityData}
        />
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">财务概览</h1>
              <p className="text-muted-foreground">查看您的财务状况和趋势</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard title="总收入" value={totalIncome} icon={TrendingUp} variant="income" />
            <StatCard title="总支出" value={totalExpense} icon={TrendingDown} variant="expense" />
            <StatCard title="结余" value={balance} icon={PiggyBank} variant="balance" />
            <StatCard title="储蓄率" value={`${savingsRate.toFixed(1)}%`} icon={Percent} />
            <StatCard title="月均支出" value={Math.round(totalExpense / 12)} icon={Activity} />
            <StatCard title="交易笔数" value={transactions.length} icon={Wallet} />
          </div>

          <IncomeExpenseComparison data={monthlyData} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryPieChart data={categoryData} />
            <FinancialHealthScore totalIncome={totalIncome} totalExpense={totalExpense} savingsRate={savingsRate} monthlyData={monthlyData} />
          </div>

          <TransactionTable transactions={transactions} />
        </div>
      )}

      {activeTab === 'income' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">收入分析</h1>
              <p className="text-muted-foreground">深入了解收入来源和趋势</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <IncomeAnalysis transactions={transactions} monthlyData={monthlyData} />
        </div>
      )}

      {activeTab === 'expense' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">支出分析</h1>
              <p className="text-muted-foreground">分析支出结构和消费习惯</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <ExpenseAnalysis transactions={transactions} monthlyData={monthlyData} />
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">储蓄率分析</h1>
              <p className="text-muted-foreground">追踪储蓄率和财务健康</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <SavingsRateChart data={monthlyData} />
          <BalanceWaterfall data={monthlyData} />
        </div>
      )}

      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">账户分析</h1>
              <p className="text-muted-foreground">各账户收支情况</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <AccountAnalysis transactions={transactions} />
        </div>
      )}

      {activeTab === 'flow' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">资金流向</h1>
              <p className="text-muted-foreground">可视化收入支出流向分类</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <SankeyChart transactions={transactions} type="income" />
          <SankeyChart transactions={transactions} type="expense" />
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">时段对比</h1>
            <p className="text-muted-foreground">跨年度/月度财务数据对比分析</p>
          </div>
          <MultiYearSelector selectedYears={comparisonYears} availableYears={availableYears} onChange={setComparisonYears} />
          <YearComparisonChart data={yearlyComparison} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {yearlyComparison.map(year => (
              <div key={year.year} className="space-y-4">
                <h3 className="text-lg font-semibold border-b border-border pb-2">{year.year} 年</h3>
                <StatCard title="总收入" value={year.totalIncome} icon={TrendingUp} variant="income" />
                <StatCard title="总支出" value={year.totalExpense} icon={TrendingDown} variant="expense" />
                <StatCard title="结余" value={year.balance} icon={PiggyBank} variant="balance" />
                <StatCard title="储蓄率" value={year.totalIncome > 0 ? `${((year.balance / year.totalIncome) * 100).toFixed(1)}%` : '0%'} icon={Percent} />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">系统设置</h1>
            <p className="text-muted-foreground">个性化您的财务管理体验</p>
          </div>
          <Settings />
        </div>
      )}
    </DashboardLayout>
  );
};

export default Index;
