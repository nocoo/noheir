import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { DataImport } from '@/components/dashboard/DataImport';
import { DataQuality } from '@/components/dashboard/DataQuality';
import { DataManagement } from '@/components/dashboard/DataManagement';
import { FlowAnalysis } from '@/components/dashboard/FlowAnalysis';
import { IncomeAnalysis } from '@/components/dashboard/IncomeAnalysis';
import { ExpenseAnalysis } from '@/components/dashboard/ExpenseAnalysis';
import { TransferAnalysis } from '@/components/dashboard/TransferAnalysis';
import { AccountAnalysis } from '@/components/dashboard/AccountAnalysis';
import { Settings } from '@/components/dashboard/Settings';
import { SankeyChart } from '@/components/dashboard/SankeyChart';
import { YearSelector } from '@/components/dashboard/YearSelector';
import type { DataQualityMetrics, TransactionValidation } from '@/types/data';
import { ExpenseHeatmap } from '@/components/dashboard/ExpenseHeatmap';
import { IncomeHeatmap } from '@/components/dashboard/IncomeHeatmap';
import { IncomeExpenseComparison } from '@/components/dashboard/IncomeExpenseComparison';
import { SavingsRateChart } from '@/components/dashboard/SavingsRateChart';
import { BalanceWaterfall } from '@/components/dashboard/BalanceWaterfall';
import { YearComparisonChart } from '@/components/dashboard/YearComparisonChart';
import { MultiYearSelector } from '@/components/dashboard/MultiYearSelector';
import { FinancialFreedomAnalysis } from '@/components/dashboard/FinancialFreedomAnalysis';
import { ProductsLibrary } from '@/components/assets/ProductsLibrary';
import { CapitalUnitsManager } from '@/components/assets/CapitalUnitsManager';
import { CapitalDashboard } from '@/components/assets/CapitalDashboard';
import { WarehouseView } from '@/components/assets/WarehouseView';
import { StrategySunburst } from '@/components/assets/StrategySunburst';
import { LiquidityLadder } from '@/components/assets/LiquidityLadder';
import { FinancialHealthPage } from '@/pages/FinancialHealthPage';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingPage } from '@/components/pages/LoadingPage';
import { LoginPage } from '@/components/pages/LoginPage';
import { TrendingUp, TrendingDown, PiggyBank, Percent, HeartPulse } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [qualityViewYear, setQualityViewYear] = useState<number | null>(null);
  const [qualityData, setQualityData] = useState<{ year: number; metrics: DataQualityMetrics; validations: TransactionValidation[] } | null>(null);

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
    deleteYearData,
    clearAll,
    exportData,
    storedYearsData,
    isLoading,
    loadStoredData,
    getQualityForYear,
  } = useTransactions();

  // All hooks must be called before any early returns
  const savingsRate = useMemo(() => {
    return totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  }, [totalIncome, totalExpense]);

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

  const handleGoToImport = () => {
    setActiveTab('import');
  };

  const previousYearCategoryData = useMemo(() => {
    if (selectedYear === null) return [];
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

  // Show Loading page when auth is loading or data is loading for the first time
  if (authLoading || (user && isLoading)) {
    return <LoadingPage />;
  }

  // Show Login page when user is not authenticated
  if (!user) {
    return <LoginPage />;
  }

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">数据导入</h1>
            <p className="text-muted-foreground">上传交易数据文件开始分析</p>
          </div>
          <DataImport onUploadComplete={loadStoredData} />
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">数据质量评估</h1>
            <p className="text-muted-foreground">检查数据完整性和有效性</p>
          </div>
          {qualityData ? (
            <DataQuality
              metrics={qualityData.metrics}
              validations={qualityData.validations}
            />
          ) : (
            <p className="text-muted-foreground">请在"数据管理"页面选择年份查看质量评估</p>
          )}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="总收入" value={totalIncome} icon={TrendingUp} variant="income" />
            <StatCard title="总支出" value={totalExpense} icon={TrendingDown} variant="expense" />
            <StatCard title="结余" value={balance} icon={PiggyBank} variant="balance" />
            <StatCard title="储蓄率" value={`${savingsRate.toFixed(1)}%`} icon={Percent} variant="savings" savingsValue={savingsRate} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ExpenseHeatmap transactions={transactions} year={selectedYear} />
            <IncomeHeatmap transactions={transactions} year={selectedYear} />
          </div>

          <IncomeExpenseComparison data={monthlyData} />

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

      {activeTab === 'transfer' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">转账分析</h1>
              <p className="text-muted-foreground">转账和信用卡还款记录分析</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <TransferAnalysis transactions={transactions} monthlyData={monthlyData} />
        </div>
      )}

      {activeTab === 'financial-health' && (
        <FinancialHealthPage
          transactions={transactions}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          savingsRate={savingsRate}
          monthlyData={monthlyData}
          selectedYear={selectedYear}
          availableYears={availableYears}
          onYearChange={setSelectedYear}
        />
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

      {activeTab === 'freedom' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">财务自由分析</h1>
              <p className="text-muted-foreground">基于被动收入的财务自由度评估</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <FinancialFreedomAnalysis transactions={transactions} year={selectedYear} />
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
        <FlowAnalysis
          transactions={transactions}
          selectedYear={selectedYear}
          availableYears={availableYears}
          onYearChange={setSelectedYear}
        />
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

      {activeTab === 'capital-dashboard' && <CapitalDashboard />}

      {activeTab === 'warehouse' && <WarehouseView />}

      {activeTab === 'strategy-sunburst' && <StrategySunburst />}

      {activeTab === 'liquidity-ladder' && <LiquidityLadder />}

      {activeTab === 'products' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">产品表</h1>
            <p className="text-muted-foreground">管理理财产品信息</p>
          </div>
          <ProductsLibrary />
        </div>
      )}

      {activeTab === 'funds' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">资金表</h1>
            <p className="text-muted-foreground">管理资金分配情况</p>
          </div>
          <CapitalUnitsManager />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">系统设置</h1>
            <p className="text-muted-foreground">个性化您的个人财务管理体验</p>
          </div>
          <Settings />
        </div>
      )}
    </DashboardLayout>
  );
};

export default Index;
