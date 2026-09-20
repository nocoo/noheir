import type { RouteObject } from "react-router";
import { RootLayout } from "@/components/layout/root-layout";
import { RouteErrorBoundary } from "@/components/route-error-boundary";

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/",
        lazy: async () => {
          const mod = await import("@/app/page");
          return { Component: mod.default, loader: mod.overviewLoader };
        },
      },
      {
        path: "/income",
        lazy: async () => {
          const mod = await import("@/app/income/page");
          return { Component: mod.default, loader: mod.incomeLoader };
        },
      },
      {
        path: "/expense",
        lazy: async () => {
          const mod = await import("@/app/expense/page");
          return { Component: mod.default, loader: mod.expenseLoader };
        },
      },
      {
        path: "/flow",
        lazy: async () => {
          const mod = await import("@/app/flow/page");
          return { Component: mod.default, loader: mod.flowLoader };
        },
      },
      {
        path: "/savings",
        lazy: async () => {
          const mod = await import("@/app/savings/page");
          return { Component: mod.default, loader: mod.savingsLoader };
        },
      },
      {
        path: "/compare",
        lazy: async () => {
          const mod = await import("@/app/compare/page");
          return { Component: mod.default, loader: mod.compareLoader };
        },
      },
      {
        path: "/account",
        lazy: async () => {
          const mod = await import("@/app/account/page");
          return { Component: mod.default, loader: mod.accountLoader };
        },
      },
      {
        path: "/account-detail",
        lazy: async () => {
          const mod = await import("@/app/account-detail/page");
          return { Component: mod.default, loader: mod.accountDetailLoader };
        },
      },
      {
        path: "/financial-health",
        lazy: async () => {
          const mod = await import("@/app/financial-health/page");
          return { Component: mod.default, loader: mod.financialHealthLoader };
        },
      },
      {
        path: "/capital-dashboard",
        lazy: async () => {
          const mod = await import("@/app/capital-dashboard/page");
          return { Component: mod.default, loader: mod.capitalDashboardLoader };
        },
      },
      {
        path: "/capital-decisions",
        lazy: async () => {
          const mod = await import("@/app/capital-decisions/page");
          return { Component: mod.default, loader: mod.capitalDecisionsLoader };
        },
      },
      {
        path: "/capital-logs",
        lazy: async () => {
          const mod = await import("@/app/capital-logs/page");
          return { Component: mod.default, loader: mod.capitalLogsLoader };
        },
      },
      {
        path: "/funds",
        lazy: async () => {
          const mod = await import("@/app/funds/page");
          return { Component: mod.default, loader: mod.fundsLoader };
        },
      },
      {
        path: "/liquidity",
        lazy: async () => {
          const mod = await import("@/app/liquidity/page");
          return { Component: mod.default, loader: mod.liquidityLoader };
        },
      },
      {
        path: "/products",
        lazy: async () => {
          const mod = await import("@/app/products/page");
          return { Component: mod.default, loader: mod.productsLoader };
        },
      },
      {
        path: "/strategy",
        lazy: async () => {
          const mod = await import("@/app/strategy/page");
          return { Component: mod.default, loader: mod.strategyLoader };
        },
      },
      {
        path: "/warehouse",
        lazy: async () => {
          const mod = await import("@/app/warehouse/page");
          return { Component: mod.default, loader: mod.warehouseLoader };
        },
      },
      {
        path: "/plan/calendar",
        lazy: async () => {
          const mod = await import("@/app/plan/calendar/page");
          return { Component: mod.default, loader: mod.planCalendarLoader };
        },
      },
      {
        path: "/plan/categories",
        lazy: async () => {
          const mod = await import("@/app/plan/categories/page");
          return { Component: mod.default, loader: mod.planCategoriesLoader };
        },
      },
      {
        path: "/settings",
        lazy: async () => {
          const mod = await import("@/app/settings/page");
          return { Component: mod.default, loader: mod.settingsLoader };
        },
      },
      {
        path: "/category-settings",
        lazy: async () => {
          const mod = await import("@/app/category-settings/page");
          return { Component: mod.default, loader: mod.categorySettingsLoader };
        },
      },
      {
        path: "/account-types",
        lazy: async () => {
          const mod = await import("@/app/account-types/page");
          return { Component: mod.default, loader: mod.accountTypesLoader };
        },
      },
      {
        path: "/balance-anchors",
        lazy: async () => {
          const mod = await import("@/app/balance-anchors/page");
          return { Component: mod.default, loader: mod.balanceAnchorsLoader };
        },
      },
      {
        path: "/ai-insight",
        lazy: async () => {
          const mod = await import("@/app/ai-insight/page");
          return { Component: mod.default, loader: mod.aiInsightLoader };
        },
      },
      {
        path: "/ai-settings",
        lazy: async () => {
          const mod = await import("@/app/ai-settings/page");
          return { Component: mod.default, loader: mod.aiSettingsLoader };
        },
      },
      {
        path: "/mcp-tokens",
        lazy: async () => {
          const mod = await import("@/app/mcp-tokens/page");
          return { Component: mod.default };
        },
      },
      {
        path: "/manage",
        lazy: async () => {
          const mod = await import("@/app/manage/page");
          return { Component: mod.default, loader: mod.manageLoader };
        },
      },
      {
        path: "/quality",
        lazy: async () => {
          const mod = await import("@/app/quality/page");
          return { Component: mod.default, loader: mod.qualityLoader };
        },
      },
      {
        path: "/import",
        lazy: async () => {
          const mod = await import("@/app/import/page");
          return { Component: mod.default };
        },
      },
      {
        path: "/freedom",
        lazy: async () => {
          const mod = await import("@/app/freedom/page");
          return { Component: mod.default, loader: mod.freedomLoader };
        },
      },
      {
        path: "/login",
        lazy: async () => {
          const mod = await import("@/app/login/page");
          return { Component: mod.default };
        },
      },
      {
        path: "/terms",
        lazy: async () => {
          const mod = await import("@/app/terms/page");
          return { Component: mod.default };
        },
      },
      {
        path: "/privacy",
        lazy: async () => {
          const mod = await import("@/app/privacy/page");
          return { Component: mod.default };
        },
      },
    ],
  },
];
