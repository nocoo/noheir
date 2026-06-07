import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

// Files excluded from coverage. Centralised so both the global coverage
// exclude and any per-project override stay in sync.
const coverageExclude = [
  // Anything not a .ts source file
  "src/**/*.tsx",
  "src/**/*.d.ts",
  "src/__tests__/**",
  // Surface code (Server Components, Server Actions, RSC pages)
  "src/app/**",
  "src/components/**",
  "src/hooks/**",
  // Wiring / framework boundaries — exercised by integration only
  "src/auth.ts",
  "src/proxy.ts",
  "src/lib/db.ts",
  "src/lib/utils.ts",
  "src/lib/version.ts",
  "src/lib/constants.ts",
  "src/lib/action-result.ts",
  "src/lib/api-helpers.ts",
  "src/lib/capital-mappers.ts",
  "src/lib/category-builders.ts",
  "src/lib/navigation.ts",
  "src/lib/proxy-logic.ts",
  "src/lib/recurring-payment-detector.ts",
  "src/lib/table-columns.ts",
  "src/lib/worker-db-client.ts",
  "src/lib/palette.ts",
  "src/lib/mcp/server.ts",
  "src/lib/mcp/tools/delete.ts",
  "src/lib/mcp/tools/summary.ts",
  "src/lib/mcp/tools/product.ts",
  "src/services/mcp-clients.ts",
  "src/services/mcp-auth-codes.ts",
  "src/lib/mcp/tools/unit.ts",
  "src/domain/data-management.ts",
  "src/domain/dashboard/account-detail.ts",
  "src/domain/dashboard/account-analysis.ts",
  "src/domain/dashboard/financial-freedom.ts",
  "src/domain/dashboard/financial-health.ts",
  "src/domain/dashboard/savings-rate.ts",
  "src/domain/dashboard/transaction-analysis.ts",
  "src/domain/assets/strategy-sunburst.ts",
  "src/domain/import/parse-chinese-csv.ts",
  "src/domain/import/parse-chinese-transfer-csv.ts",
  "src/domain/import/parse-import-file.ts",
  "src/domain/settings/balance-anchors.ts",
  "src/domain/settings/site-name.ts",
  "src/domain/settings/account-types.ts",
  "src/lib/chart-config.ts",
  "src/lib/financial-health-algorithm.ts",
  "src/lib/tag-colors.ts",
  "src/domain/assets/capital-dashboard.ts",
  "src/domain/assets/capital-decisions.ts",
  "src/lib/mcp/tools/portfolio.ts",
  "src/lib/mcp/tools/query.ts",
  "src/lib/mcp/tools/resolver.ts",
];

export default defineConfig({
  resolve: { alias },
  test: {
    // Two projects so React component tests can use jsdom without
    // forcing the existing pure-logic .test.ts suite to pay the
    // jsdom setup cost.
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          include: ["src/__tests__/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "jsdom",
          include: ["src/__tests__/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["src/__tests__/setup/jsdom.ts"],
          globals: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: coverageExclude,
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 95,
      },
    },
  },
});
