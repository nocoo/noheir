# 页面结构与数据输入梳理

目标：按页面梳理功能与数据输入，识别统一数据源与页面私有数据，以便后续抽象 Model / Data Model。

## 全局统一数据源（核心）

- Auth：`useAuth`（用户与登录态）
- Settings：`useSettings`（全局配置与显示偏好）
- Transactions：`useTransactions`（交易数据、选年、统计派生）
- Assets：`useAssets`/`AssetsDataContext`（资产产品与资金单元相关数据）

说明：凡是页面直接或间接使用上述 hooks/context 的数据，视为“统一数据源”。页面自身 `useState/useMemo` 的状态视为“页面私有数据”。

## 页面与数据输入

### 应用入口与路由

- `src/App.tsx`
  - 功能：应用入口，注入全局 Provider（Auth/Settings/Assets/React Query/Tooltip/Toast），声明路由。
  - 数据输入：统一数据源（Providers + 路由），无页面私有数据。

### 首页与主面板（多 Tab）

- `src/pages/Index.tsx`
  - 功能：主面板容器，按 `activeTab` 渲染不同功能页面；负责整合交易数据、设置、年份选择等。
  - 数据输入：统一数据源（`useAuth`、`useSettings`、`useTransactions`），页面私有数据（`activeTab`、`qualityViewYear`、`qualityData`、`savingsRate`）。
  - 备注：多数“页面”实际是 `activeTab` 内的子页面组件，统一数据主要从 `useTransactions` 分发。

#### Index 内的 Tab 页面（按 activeTab）

- 导入收支流水（`activeTab === 'import'`）
  - 功能：上传 CSV 并导入交易数据。
  - 数据输入：统一数据源（`useTransactions.loadStoredData`），页面私有数据：无。

- 转账导入（`transfer-import`）
  - 功能：导入转账类交易。
  - 数据输入：统一数据源（依赖 `useTransactions` 中的数据管理流程），页面私有数据：无（组件内部自有状态）。

- 数据质量评估（`quality`）
  - 功能：显示某一年的数据质量指标与校验结果。
  - 数据输入：统一数据源（`useTransactions.getQualityForYear` + `storedYearsData`），页面私有数据（`qualityData` 由 Index 缓存）。

- 数据管理（`manage`）
  - 功能：管理年度数据（删除、清空、导出），并跳转导入页面。
  - 数据输入：统一数据源（`useTransactions` 的 storedYearsData 与管理方法），页面私有数据：无。

- 财务概览（`overview`）
  - 功能：概览统计、热力图、收支趋势、交易表。
  - 数据输入：统一数据源（`useTransactions`：transactions、monthlyData、totalIncome/Expense、selectedYear、availableYears），页面私有数据（`savingsRate`）。

- 收入分析（`income`）
  - 功能：收入结构与趋势分析。
  - 数据输入：统一数据源（`transactions`、`monthlyData`、`selectedYear`、`availableYears`），页面私有数据：无。

- 支出分析（`expense`）
  - 功能：支出结构与趋势分析。
  - 数据输入：统一数据源（`transactions`、`monthlyData`、`selectedYear`、`availableYears`），页面私有数据：无。

- 财务健康分析（`financial-health`）
  - 功能：五维评分 + 剪刀差趋势 + 刚性分析等。
  - 数据输入：统一数据源（`transactions`、`monthlyData`、`totalIncome/Expense`、`selectedYear`、`availableYears`、`settings.fixedExpenseCategories`），页面私有数据（局部 memo 派生）。

- AI 财务洞察（`ai-insight`）
  - 功能：周期性付款检测与洞察。
  - 数据输入：统一数据源（`useTransactions.allTransactions`），页面私有数据（`aiInsight`、`isGenerating`、`lastGenerated`）。

- 储蓄率分析（`savings`）
  - 功能：储蓄率与结余瀑布图。
  - 数据输入：统一数据源（`monthlyData`、`selectedYear`、`availableYears`），页面私有数据：无。

- 财务自由分析（`freedom`）
  - 功能：被动收入/自由度评估。
  - 数据输入：统一数据源（`transactions`、`selectedYear`、`availableYears`），页面私有数据：无。

- 账户分析（`account`）
  - 功能：账户维度的收支与分布分析。
  - 数据输入：统一数据源（`transactions`、`settings.accountTypes`），页面私有数据（分组方式、图表派生）。

- 资金流向分析（`flow`）
  - 功能：资金流向与结构分析。
  - 数据输入：统一数据源（`transactions`、`selectedYear`、`availableYears`），页面私有数据：无。

- 账户详情（`account-detail`）
  - 功能：单账户交易明细与趋势。
  - 数据输入：统一数据源（`allTransactions`、`selectedYear`、`availableYears`），页面私有数据：无。

- 时段对比（`compare`）
  - 功能：跨年度/时段对比。
  - 数据输入：统一数据源（`yearlyComparison`、`comparisonYears`、`availableYears`、`settings.targetSavingsRate`），页面私有数据（选择年份数组由 `useTransactions` 管理）。

- 资金总览（`capital-dashboard`）
  - 功能：资金与资产分布看板。
  - 数据输入：统一数据源（`useAssets`：capitalOverview、unitsDisplay）。

- 资金决策（`capital-decisions`）
  - 功能：需要操作的资金单元列表与快速处理。
  - 数据输入：统一数据源（`useAssets`：units/products/mutations），页面私有数据（筛选、排序、对话框状态）。

- 仓库视图（`warehouse`）
  - 功能：资金单元库存视图与热力图。
  - 数据输入：统一数据源（`useAssets`：units/products/mutations + `useTransactions`：transactions），页面私有数据（对话框状态）。

- 策略 Sunburst（`strategy-sunburst`）
  - 功能：资产策略分布图。
  - 数据输入：统一数据源（`useAssets` 或组件内部数据源），页面私有数据：组件自带。
  - 备注：具体输入需结合 `src/components/assets/StrategySunburst.tsx` 进一步细化。

- 流动性梯（`liquidity-ladder`）
  - 功能：资产流动性分层可视化。
  - 数据输入：统一数据源（`useAssets` 或组件内部数据源），页面私有数据：组件自带。
  - 备注：具体输入需结合 `src/components/assets/LiquidityLadder.tsx` 进一步细化。

- 产品表（`products`）
  - 功能：理财产品 CRUD。
  - 数据输入：统一数据源（`useAssets`：products/units/mutations + `useSettings`），页面私有数据（筛选、排序、表单状态）。

- 资金表（`funds`）
  - 功能：资金单元 CRUD 与投放管理。
  - 数据输入：统一数据源（`useAssets`：units/products/mutations），页面私有数据（筛选、排序、表单状态）。

- 通用设置（`settings`）
  - 功能：应用级偏好设置。
  - 数据输入：统一数据源（`useSettings`），页面私有数据：组件自带。

- AI 助手配置（`ai-settings`）
  - 功能：AI 模型与参数配置。
  - 数据输入：统一数据源（`useSettings` 或专用配置存储），页面私有数据：组件自带。

- 账户设置（`account-types`）
  - 功能：账户类型与余额锚点配置。
  - 数据输入：统一数据源（`useSettings`），页面私有数据：组件自带。

### 独立页面

- `src/pages/FinancialHealthPage.tsx`
  - 功能：财务健康分析详情页（由 Index 传入数据）。
  - 数据输入：统一数据源（来自 `useTransactions` + `useSettings`，由父页面传入），页面私有数据（memo 派生评分与展示结构）。

- `src/pages/NotFound.tsx`
  - 功能：404 页面。
  - 数据输入：无统一数据，页面私有数据：无。

- `src/components/pages/LoginPage.tsx`
  - 功能：登录页面。
  - 数据输入：统一数据源（`useAuth`），页面私有数据：无。

- `src/components/pages/LoadingPage.tsx`
  - 功能：全局加载占位。
  - 数据输入：无统一数据，页面私有数据：无。

- `src/components/pages/TermsPage.tsx`
  - 功能：条款页。
  - 数据输入：无统一数据，页面私有数据：无。

- `src/components/pages/PrivacyPage.tsx`
  - 功能：隐私政策页。
  - 数据输入：无统一数据，页面私有数据：无。

## 数据流转备注

- 交易主线：`useTransactions` 负责加载与派生（选年、月度、统计、对比）。多数财务页面直接消费该统一数据源。
- 资产主线：`useAssets` / `AssetsDataContext` 负责产品与资金单元数据，资产相关页面直接消费统一数据源。
- 交叉场景：`WarehouseView` 同时使用资产数据与交易数据，属于跨域数据聚合页面，后续适合作为 ViewModel 抽取示例。
