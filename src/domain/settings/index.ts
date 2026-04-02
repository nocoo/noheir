export {
  normalizeSiteName,
  validateSiteName,
  getSiteNameDisplay,
} from "./site-name";

export {
  clampSavingsRate,
  getSavingsRateTone,
} from "./savings-rate";

export {
  toggleCategory,
  toggleAllInGroup,
  countSelectedInGroup,
} from "./categories";

export {
  clampReturnRate,
  clampMinReturnRate,
  clampMaxReturnRate,
  getReturnRateStatus,
  getReturnRateTextClass,
  getReturnRateBgClass,
  getReturnRateDescription,
  DEFAULT_MIN_RETURN_RATE,
  DEFAULT_MAX_RETURN_RATE,
} from "./return-rate";

export type { ReturnRateStatus } from "./return-rate";

export {
  PREDEFINED_AI_URLS,
  PREDEFINED_AI_MODELS,
  isCustomOption,
  isConfigComplete,
  buildFinalConfig,
} from "./ai-config";

export {
  getUniqueAccounts,
  buildAccountTypesUpdate,
  applyBatchAccountTypes,
  groupAccountsByType,
} from "./account-types";

export {
  groupAnchorsByAccount,
  getDifferenceLevel,
  calculateBalanceAtDate,
  calculateAnchorDifferences,
} from "./balance-anchors";

export {
  getMcpProjectPath,
  buildMcpConfigJson,
  isMcpConfigComplete,
} from "./mcp-config";

export type { McpConfigParams } from "./mcp-config";

// ── Theme & Color Scheme ──

export {
  VALID_THEMES,
  VALID_COLOR_SCHEMES,
  isValidTheme,
  isValidColorScheme,
  normalizeTheme,
  normalizeColorScheme,
  getIncomeTextClass,
  getExpenseTextClass,
  getIncomeColorHsl,
  getExpenseColorHsl,
  getIncomeColorHex,
  getExpenseColorHex,
  THEME_OPTIONS,
  COLOR_SCHEME_OPTIONS,
} from "./theme";

// ── Income Categories ──

export {
  toggleActiveIncomeCategory,
  isActiveIncome,
  getIncomeTypeLabel,
  getIncomeTypeDescription,
  DEFAULT_ACTIVE_INCOME_HINTS,
} from "./income-categories";

// ── Expense Categories ──

export {
  toggleFixedExpenseCategory,
  isFixedExpense,
  getExpenseTypeLabel,
  getExpenseTypeDescription,
  DEFAULT_FIXED_EXPENSE_HINTS,
} from "./expense-categories";
