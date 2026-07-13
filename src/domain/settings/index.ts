export {
  applyBatchAccountTypes,
  buildAccountTypesUpdate,
  getUniqueAccounts,
  groupAccountsByType,
} from "./account-types";
export {
  buildFinalConfig,
  isConfigComplete,
  isCustomOption,
  PREDEFINED_AI_MODELS,
  PREDEFINED_AI_URLS,
} from "./ai-config";
export {
  calculateAnchorDifferences,
  calculateBalanceAtDate,
  getDifferenceLevel,
  groupAnchorsByAccount,
} from "./balance-anchors";
export {
  countSelectedInGroup,
  toggleAllInGroup,
  toggleCategory,
} from "./categories";
export type { McpConfigParams } from "./mcp-config";
export {
  buildMcpConfigJson,
  getMcpProjectPath,
  isMcpConfigComplete,
} from "./mcp-config";
export type { ReturnRateStatus } from "./return-rate";
export {
  clampMaxReturnRate,
  clampMinReturnRate,
  clampReturnRate,
  DEFAULT_MAX_RETURN_RATE,
  DEFAULT_MIN_RETURN_RATE,
  getReturnRateBgClass,
  getReturnRateDescription,
  getReturnRateStatus,
  getReturnRateTextClass,
} from "./return-rate";
export {
  clampSavingsRate,
  getSavingsRateTone,
} from "./savings-rate";
export {
  getSiteNameDisplay,
  normalizeSiteName,
  validateSiteName,
} from "./site-name";

// ── Theme & Color Scheme ──

export {
  COLOR_SCHEME_OPTIONS,
  getExpenseColorHex,
  getExpenseColorHsl,
  getExpenseTextClass,
  getIncomeColorHex,
  getIncomeColorHsl,
  getIncomeTextClass,
  isValidColorScheme,
  isValidTheme,
  normalizeColorScheme,
  normalizeTheme,
  THEME_OPTIONS,
  VALID_COLOR_SCHEMES,
  VALID_THEMES,
} from "./theme";

// ── Income Categories ──

export {
  DEFAULT_ACTIVE_INCOME_HINTS,
  getIncomeTypeDescription,
  getIncomeTypeLabel,
  isActiveIncome,
  toggleActiveIncomeCategory,
} from "./income-categories";

// ── Expense Categories ──

export {
  DEFAULT_FIXED_EXPENSE_HINTS,
  getExpenseTypeDescription,
  getExpenseTypeLabel,
  isFixedExpense,
  toggleFixedExpenseCategory,
} from "./expense-categories";
