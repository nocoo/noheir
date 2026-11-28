import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

// Files excluded from coverage. Centralised so both the global coverage
// exclude and any per-project override stay in sync.
const coverageExclude = [
  // Anything not a .ts source file
  "src/**/*.tsx",
  "src/**/*.d.ts",
  "**/index.ts",
  "**/types.ts",
  "src/domain/types.ts",
  "src/main.tsx",
  "src/routes.tsx",
  "src/__tests__/**",
  // Surface code (Server Components, Server Actions, RSC pages)
  "src/app/**",
  "src/components/**",
  "src/views/**",
  "src/pages/**",
  "src/hooks/**",
  // Pure type / constant / re-export modules and worker HTTP client boundary
  "src/lib/action-result.ts",
  "src/lib/constants.ts",
  "src/lib/expense-category/mappers.ts",
  "src/lib/table-columns.ts",
  "src/lib/utils.ts",
  "src/lib/version.ts",
  "src/lib/worker-db-client.ts",
  "src/lib/category-builders.ts",
];

export default defineConfig({
  resolve: { alias },
  test: {
    allowOnly: false,
    passWithNoTests: false,
    maxWorkers: 4,
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: coverageExclude,
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
