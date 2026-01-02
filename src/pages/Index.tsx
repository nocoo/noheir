import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { DataImport } from '@/components/dashboard/DataImport';
import { TransferImportPage } from '@/components/dashboard/TransferImportPage';
import { DataQuality } from '@/components/dashboard/DataQuality';
import { DataManagement } from '@/components/dashboard/DataManagement';
import { FlowAnalysis } from '@/components/dashboard/FlowAnalysis';
import { TransactionAnalysis } from '@/components/dashboard/TransactionAnalysis';
import { AccountAnalysis } from '@/components/dashboard/AccountAnalysis';
import { AccountDetail } from '@/components/dashboard/AccountDetail';
import { GeneralSettings } from '@/components/dashboard/GeneralSettings';
import { AISettings } from '@/components/dashboard/AISettings';
import { AccountTypeSettings } from '@/components/dashboard/AccountTypeSettings';
import { YearSelector } from '@/components/dashboard/YearSelector';
import type { DataQualityMetrics, TransactionValidation } from '@/types/data';
import { TransactionHeatmap } from '@/components/dashboard/TransactionHeatmap';
import { IncomeExpenseComparison } from '@/components/dashboard/IncomeExpenseComparison';
import { SavingsRateChart } from '@/components/dashboard/SavingsRateChart';
import { BalanceWaterfall } from '@/components/dashboard/BalanceWaterfall';
import { YearComparisonChart } from '@/components/dashboard/YearComparisonChart';
import { MultiYearSelector } from '@/components/dashboard/MultiYearSelector';
import { FinancialFreedomAnalysis } from '@/components/dashboard/FinancialFreedomAnalysis';
import { ProductsLibrary } from '@/components/assets/ProductsLibrary';
import { CapitalUnitsManager } from '@/components/assets/CapitalUnitsManager';
import { CapitalDashboard } from '@/components/assets/CapitalDashboard';
import { CapitalDecisions } from '@/components/assets/CapitalDecisions';
import { WarehouseView } from '@/components/assets/WarehouseView';
import { StrategySunburst } from '@/components/assets/StrategySunburst';
import { LiquidityLadder } from '@/components/assets/LiquidityLadder';
import { FinancialHealthPage } from '@/pages/FinancialHealthPage';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { LoadingPage } from '@/components/pages/LoadingPage';
import { LoginPage } from '@/components/pages/LoginPage';
import { TrendingUp, TrendingDown, PiggyBank, Percent } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp, gridContainer, gridItem } from '@/lib/animations';

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

  const { transfers } = useTransfers();

  const { settings } = useSettings();

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

  const handleGoToTransferImport = () => {
    setActiveTab('transfer-import');
  };

  const handleGoToManage = () => {
    setActiveTab('manage');
  };

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
        <motion.div
          key="import"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold">导入收支流水</h1>
            <p className="text-muted-foreground">上传收支流水 CSV 文件到云端</p>
          </div>
          <DataImport
            onUploadComplete={loadStoredData}
            onNavigateToManage={handleGoToManage}
          />
        </motion.div>
      )}

      {activeTab === 'transfer-import' && (
        <motion.div
          key="transfer-import"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <TransferImportPage onNavigateToManage={handleGoToManage} />
        </motion.div>
      )}

      {activeTab === 'quality' && (
        <motion.div
          key="quality"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
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
        </motion.div>
      )}

      {activeTab === 'manage' && (
        <motion.div
          key="manage"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
          <DataManagement
            storedYearsData={storedYearsData}
            isLoading={isLoading}
            onDeleteYear={deleteYearData}
            onClearAll={clearAll}
            onExport={exportData}
            onGoToImport={handleGoToImport}
            onGoToTransferImport={handleGoToTransferImport}
            onViewQuality={handleViewQuality}
            qualityData={qualityData}
          />
        </motion.div>
      )}

      {activeTab === 'overview' && (
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
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
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
              <StatCard title="储蓄率" value={`${savingsRate.toFixed(1)}%`} icon={Percent} variant="savings" savingsValue={savingsRate} targetSavingsRate={settings.targetSavingsRate} />
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TransactionHeatmap transactions={transactions} year={selectedYear} type="expense" />
            <TransactionHeatmap transactions={transactions} year={selectedYear} type="income" />
          </div>

          <IncomeExpenseComparison data={monthlyData} />

          <TransactionTable transactions={transactions} />
        </motion.div>
      )}

      {activeTab === 'income' && (
        <motion.div
          key="income"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">收入分析</h1>
              <p className="text-muted-foreground">深入了解收入来源和趋势</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <TransactionAnalysis transactions={transactions} monthlyData={monthlyData} type="income" />
        </motion.div>
      )}

      {activeTab === 'expense' && (
        <motion.div
          key="expense"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">支出分析</h1>
              <p className="text-muted-foreground">分析支出结构和消费习惯</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <TransactionAnalysis transactions={transactions} monthlyData={monthlyData} type="expense" />
        </motion.div>
      )}

      {activeTab === 'financial-health' && (
        <motion.div
          key="financial-health"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
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
        </motion.div>
      )}

      {activeTab === 'savings' && (
        <motion.div
          key="savings"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">储蓄率分析</h1>
              <p className="text-muted-foreground">追踪储蓄率和财务健康</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <SavingsRateChart data={monthlyData} />
          <BalanceWaterfall data={monthlyData} />
        </motion.div>
      )}

      {activeTab === 'freedom' && (
        <motion.div
          key="freedom"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">财务自由分析</h1>
              <p className="text-muted-foreground">基于被动收入的财务自由度评估</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <FinancialFreedomAnalysis transactions={transactions} year={selectedYear} />
        </motion.div>
      )}

      {activeTab === 'account' && (
        <motion.div
          key="account"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">账户分析</h1>
              <p className="text-muted-foreground">各账户收支情况</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <AccountAnalysis transactions={transactions} />
        </motion.div>
      )}

      {activeTab === 'flow' && (
        <motion.div
          key="flow"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
          <FlowAnalysis
            transactions={transactions}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onYearChange={setSelectedYear}
          />
        </motion.div>
      )}

      {activeTab === 'account-detail' && (
        <motion.div
          key="account-detail"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">账户详情</h1>
              <p className="text-muted-foreground">查看单个账户的金额变化和交易明细（含转账）</p>
            </div>
            <YearSelector selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          </div>
          <AccountDetail
            transactions={allTransactions}
            transfers={transfers}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onYearChange={setSelectedYear}
          />
        </motion.div>
      )}

      {activeTab === 'compare' && (
        <motion.div
          key="compare"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold">时段对比</h1>
            <p className="text-muted-foreground">跨年度/月度财务数据对比分析</p>
          </div>
          <MultiYearSelector selectedYears={comparisonYears} availableYears={availableYears} onChange={setComparisonYears} />
          <YearComparisonChart data={yearlyComparison} />
          <motion.div
            variants={gridContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {yearlyComparison.map(year => {
              const yearSavingsRate = year.totalIncome > 0 ? (year.balance / year.totalIncome) * 100 : 0;
              return (
                <motion.div key={year.year} variants={gridItem} className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-border pb-2">{year.year} 年</h3>
                  <StatCard title="总收入" value={year.totalIncome} icon={TrendingUp} variant="income" />
                  <StatCard title="总支出" value={year.totalExpense} icon={TrendingDown} variant="expense" />
                  <StatCard title="结余" value={year.balance} icon={PiggyBank} variant="balance" />
                  <StatCard
                    title="储蓄率"
                    value={`${yearSavingsRate.toFixed(1)}%`}
                    icon={Percent}
                    variant="savings"
                    savingsValue={yearSavingsRate}
                    targetSavingsRate={settings.targetSavingsRate}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {activeTab === 'capital-dashboard' && (
        <motion.div
          key="capital-dashboard"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
          <CapitalDashboard />
        </motion.div>
      )}

      {activeTab === 'capital-decisions' && (
        <motion.div
          key="capital-decisions"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
          <CapitalDecisions />
        </motion.div>
      )}

      {activeTab === 'warehouse' && (
        <motion.div
          key="warehouse"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
          <WarehouseView />
        </motion.div>
      )}

      {activeTab === 'strategy-sunburst' && (
        <motion.div
          key="strategy-sunburst"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
          <StrategySunburst />
        </motion.div>
      )}

      {activeTab === 'liquidity-ladder' && (
        <motion.div
          key="liquidity-ladder"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
        >
          <LiquidityLadder />
        </motion.div>
      )}

      {activeTab === 'products' && (
        <motion.div
          key="products"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold">产品表</h1>
            <p className="text-muted-foreground">管理理财产品信息</p>
          </div>
          <ProductsLibrary />
        </motion.div>
      )}

      {activeTab === 'funds' && (
        <motion.div
          key="funds"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold">资金表</h1>
            <p className="text-muted-foreground">管理资金分配情况</p>
          </div>
          <CapitalUnitsManager />
        </motion.div>
      )}

      {activeTab === 'settings' && (
        <motion.div
          key="settings"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold">通用设置</h1>
            <p className="text-muted-foreground">个性化您的个人财务管理体验</p>
          </div>
          <GeneralSettings />
        </motion.div>
      )}

      {activeTab === 'ai-settings' && (
        <motion.div
          key="ai-settings"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold">AI 助手配置</h1>
            <p className="text-muted-foreground">配置您的 AI 助手（BYOM - Bring Your Own Model）</p>
          </div>
          <AISettings />
        </motion.div>
      )}

      {activeTab === 'account-types' && (
        <motion.div
          key="account-types"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold">账户类型设置</h1>
            <p className="text-muted-foreground">为每个账户标记类型，便于后续财务分析</p>
          </div>
          <AccountTypeSettings />
        </motion.div>
      )}
    </DashboardLayout>
  );
};

export default Index;
