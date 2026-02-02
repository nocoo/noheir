# 页面与数据流

## 统一数据源

- Auth：`useAuth`
- Settings：`useSettings`
- Transactions：`useTransactions`
- Assets：`useAssets` / `AssetsDataContext`

## 页面概览

- `src/pages/Index.tsx`：主面板容器，按 `activeTab` 渲染功能页面
- `src/pages/FinancialHealthPage.tsx`：财务健康详情页

## Sidebar 页面分组

- 总览：概览、财务健康、AI 洞察
- 现金流分析：储蓄率、财务自由、收入分析、支出分析、流向分析、时段对比
- 账户管理：账户总览、账户详情
- 存量资金管理：资金总览、资金决策、仓库视图、策略透视、流动性梯队、产品表、资金表
- 系统：通用设置、AI 设置、账户设置、数据管理

下一步：了解 MVVM 规范 → [10-mvvm-guidelines.md](./10-mvvm-guidelines.md)
