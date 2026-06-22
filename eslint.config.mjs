import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "@eslint-react/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// typescript-eslint v8 strict (non type-aware). Drop the entries that only
// register the plugin — we register it ourselves below so the same plugin
// instance handles every file.
const strictRuleConfigs = tseslint.configs.strict.filter(
  (config) => !config.plugins && config.rules,
);

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "_archive/**",
      "coverage/**",
      // worker/ has its own package.json and tsconfig — covered by
      // worker:typecheck and worker tests, not the Next.js root config.
      "worker/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: "module" },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  // React (JSX runtime warnings, key checks, deprecated APIs, RSC) via
  // @eslint-react/eslint-plugin — modern replacement for eslint-plugin-react
  // that natively supports ESLint 10 and React 19.
  reactPlugin.configs["recommended-typescript"],
  // Accessibility lint — eslint-plugin-jsx-a11y still works on ESLint 10
  // despite a stale `eslint: ^9` peer (no deprecated context APIs in its source).
  jsxA11y.flatConfigs.recommended,
  // import-x is the actively-maintained fork of eslint-plugin-import; the
  // original is still blocked on ESLint 10 support (import-js/eslint-plugin-import#3230).
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  ...strictRuleConfigs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Disabled — new rules introduced by eslint-plugin-react-hooks 7.x.
      // Treat as a separate cleanup task rather than mixing refactors into
      // infra upgrades.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",

      // ---- @eslint-react ruleset suppressions ----

      // Duplicates of eslint-plugin-react-hooks rules we already run.
      // eslint-plugin-react-hooks is the authoritative source — silence the
      // duplicate to avoid double-reporting.
      "@eslint-react/hooks-extra/no-direct-set-state-in-use-effect": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/web-api/no-leaked-event-listener": "off",
      "@eslint-react/web-api/no-leaked-interval": "off",
      "@eslint-react/web-api/no-leaked-timeout": "off",

      // React 19 migration hints — shadcn/ui surface is built on forwardRef +
      // Context.Provider. Refactoring is a separate effort.
      "@eslint-react/no-forward-ref": "off",
      "@eslint-react/no-use-context": "off",
      "@eslint-react/no-context-provider": "off",

      // Performance micro-optimization hints, not blockers.
      "@eslint-react/use-state": "off",
      "@eslint-react/no-array-index-key": "off",

      // SSR initial-data caches and module-level singletons intentionally
      // touch Date.now() / mutate state during render.
      "@eslint-react/purity": "off",

      // Test helpers spread props that may include `children`.
      "@eslint-react/jsx-no-children-prop": "off",

      // ---- import-x suppressions ----

      // typescript-eslint and several flat-config plugins document their API
      // as default + named on the same export; the warning is a false positive
      // for that pattern and is noisy in eslint.config itself.
      "import-x/no-named-as-default-member": "off",
      "import-x/no-named-as-default": "off",
    },
  },
  // no-console for application code only (scripts use console legitimately)
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "mcp/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
];

export default eslintConfig;
