import {
  ParsedTransaction,
  TransactionValidation,
  FieldValidation,
  DataQualityMetrics,
  CleanedTransaction
} from '@/types/data';

/**
 * Validate a date string
 */
export function validateDate(dateStr: string): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dateStr || dateStr.trim() === '') {
    errors.push('日期为空');
    return { field: 'date', isValid: false, errors, warnings };
  }

  const date = new Date(dateStr);
  const now = new Date();

  if (isNaN(date.getTime())) {
    errors.push('日期格式无效');
    return { field: 'date', isValid: false, errors, warnings };
  }

  // Check for future dates
  if (date > now) {
    warnings.push('日期为未来时间');
  }

  // Check for very old dates (before year 2000)
  if (date.getFullYear() < 2000) {
    warnings.push('日期过于久远');
  }

  return { field: 'date', isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate category fields
 */
export function validateCategory(
  primary: string,
  secondary: string,
  tertiary: string,
  hasMapping: boolean
): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!primary || primary.trim() === '') {
    errors.push('一级分类为空');
  }

  if (!tertiary || tertiary.trim() === '') {
    warnings.push('三级分类为空');
  }

  if (!hasMapping) {
    warnings.push(`三级分类"${tertiary}"未找到对应的二级分类映射`);
  }

  if (!secondary || secondary.trim() === '' || secondary === '未分类') {
    warnings.push('二级分类为空或未映射');
  }

  return { field: 'category', isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate amount
 */
export function validateAmount(amount: number, type: 'income' | 'expense' | 'transfer'): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isNaN(amount)) {
    errors.push('金额不是有效数字');
    return { field: 'amount', isValid: false, errors, warnings };
  }

  if (amount <= 0) {
    errors.push('金额必须大于零');
  }

  // Warn about unusually large amounts
  if (amount > 1000000) {
    warnings.push('金额异常巨大，请确认');
  }

  // Warn about suspiciously precise amounts (too many decimal places)
  const decimalPlaces = amount.toString().split('.')[1]?.length || 0;
  if (decimalPlaces > 2) {
    warnings.push('金额小数位过多');
  }

  return { field: 'amount', isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate account
 */
export function validateAccount(account: string): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!account || account.trim() === '') {
    errors.push('账户为空');
  }

  return { field: 'account', isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate currency
 */
export function validateCurrency(currency: string): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validCurrencies = ['人民币', 'CNY', '美元', 'USD', '欧元', 'EUR', '港币', 'HKD'];

  if (!currency || currency.trim() === '') {
    warnings.push('币种为空');
  } else if (!validCurrencies.includes(currency)) {
    warnings.push(`未知币种: ${currency}`);
  }

  return { field: 'currency', isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate a single transaction
 */
export function validateTransaction(transaction: ParsedTransaction): TransactionValidation {
  const fields: Record<string, FieldValidation> = {};

  // Validate all fields
  fields.date = validateDate(transaction.date);
  fields.category = validateCategory(
    transaction.primaryCategory,
    transaction.secondaryCategory,
    transaction.tertiaryCategory,
    transaction.hasSecondaryMapping
  );
  fields.amount = validateAmount(transaction.amount, transaction.type);
  fields.account = validateAccount(transaction.account);
  fields.currency = validateCurrency(transaction.currency);

  // Collect all errors and warnings
  const allErrors = Object.values(fields).flatMap(f => f.errors);
  const allWarnings = Object.values(fields).flatMap(f => f.warnings);

  // Determine severity
  let severity: 'valid' | 'warning' | 'error' | 'critical' = 'valid';
  if (allErrors.length > 0) {
    severity = allErrors.some(e =>
      e.includes('为空') || e.includes('无效') || e.includes('必须大于零')
    ) ? 'critical' : 'error';
  } else if (allWarnings.length > 0) {
    severity = allWarnings.length > 2 ? 'warning' : 'valid';
  }

  return {
    transaction,
    isValid: allErrors.length === 0,
    fields,
    errors: allErrors,
    warnings: allWarnings,
    severity
  };
}

/**
 * Calculate data quality metrics from validated transactions
 */
export function calculateQualityMetrics(
  validations: TransactionValidation[]
): DataQualityMetrics {
  const totalRecords = validations.length;
  const validRecords = validations.filter(v => v.severity === 'valid').length;
  const warningRecords = validations.filter(v => v.severity === 'warning').length;
  const errorRecords = validations.filter(v => v.severity === 'error').length;
  const criticalRecords = validations.filter(v => v.severity === 'critical').length;

  // Field completeness
  const dateCompleteness = totalRecords > 0
    ? (validations.filter(v => v.fields.date.isValid).length / totalRecords) * 100
    : 0;

  const categoryCompleteness = totalRecords > 0
    ? (validations.filter(v => v.fields.category.isValid).length / totalRecords) * 100
    : 0;

  const amountCompleteness = totalRecords > 0
    ? (validations.filter(v => v.fields.amount.isValid).length / totalRecords) * 100
    : 0;

  const accountCompleteness = totalRecords > 0
    ? (validations.filter(v => v.fields.account.isValid).length / totalRecords) * 100
    : 0;

  // Data integrity checks
  const uniqueDates = new Set(validations.map(v => v.transaction.date));
  const allDates = Array.from(uniqueDates).map(d => new Date(d));
  const now = new Date();
  const futureDates = allDates.filter(d => d > now).length;
  const missingDates = validations.filter(v => !v.fields.date.isValid).length;

  // Negative and zero amounts
  const negativeAmounts = validations.filter(v => v.transaction.amount < 0).length;
  const zeroAmounts = validations.filter(v => v.transaction.amount === 0).length;

  // Category mapping checks
  const missingSecondaryMappings = validations.filter(v => !v.transaction.hasSecondaryMapping).length;
  const unmappedTertiaryCategories = [...new Set(
    validations
      .filter(v => !v.transaction.hasSecondaryMapping)
      .map(v => v.transaction.tertiaryCategory)
  )].sort();

  // Statistics
  const years = [...new Set(validations.map(v => v.transaction.year))].sort((a, b) => b - a);
  const months = [...new Set(validations.map(v => `${v.transaction.year}-${v.transaction.month}`))];
  const accounts = [...new Set(validations.map(v => v.transaction.account))];
  const primaryCategories = [...new Set(validations.map(v => v.transaction.primaryCategory))];
  const secondaryCategories = [...new Set(validations.map(v => v.transaction.secondaryCategory))];
  const tertiaryCategories = [...new Set(validations.map(v => v.transaction.tertiaryCategory))];
  const currencies = [...new Set(validations.map(v => v.transaction.currency))];

  const incomeRecords = validations.filter(v => v.transaction.type === 'income');
  const expenseRecords = validations.filter(v => v.transaction.type === 'expense');

  const incomeCount = incomeRecords.length;
  const expenseCount = expenseRecords.length;

  const totalIncome = incomeRecords.reduce((sum, v) => sum + v.transaction.amount, 0);
  const totalExpense = expenseRecords.reduce((sum, v) => sum + v.transaction.amount, 0);

  // Date range
  let dateRange: { start: string; end: string } | null = null;
  if (allDates.length > 0) {
    allDates.sort((a, b) => a.getTime() - b.getTime());
    dateRange = {
      start: allDates[0].toISOString().split('T')[0],
      end: allDates[allDates.length - 1].toISOString().split('T')[0]
    };
  }

  return {
    totalRecords,
    validRecords,
    warningRecords,
    errorRecords,
    criticalRecords,
    dateCompleteness,
    categoryCompleteness,
    amountCompleteness,
    accountCompleteness,
    missingDates,
    futureDates,
    negativeAmounts,
    zeroAmounts,
    missingSecondaryMappings,
    unmappedTertiaryCategories,
    dateRange,
    years,
    months: months.map(m => parseInt(m.split('-')[1])),
    accounts,
    primaryCategories,
    secondaryCategories,
    tertiaryCategories,
    currencies,
    incomeCount,
    expenseCount,
    totalIncome,
    totalExpense
  };
}

/**
 * Filter and clean transactions based on validation
 */
export function cleanTransactions(
  validations: TransactionValidation[],
  options: {
    includeCritical?: boolean;
    includeErrors?: boolean;
    includeWarnings?: boolean;
  } = {}
): CleanedTransaction[] {
  const {
    includeCritical = false,
    includeErrors = true,
    includeWarnings = true
  } = options;

  return validations
    .filter(v => {
      if (v.severity === 'critical' && !includeCritical) return false;
      if (v.severity === 'error' && !includeErrors) return false;
      if (v.severity === 'warning' && !includeWarnings) return false;
      return true;
    })
    .map(v => ({
      ...v.transaction,
      validatedAt: new Date(),
      validationSeverity: v.severity
    }));
}

/**
 * Get validation summary
 */
export function getValidationSummary(validations: TransactionValidation[]) {
  const metrics = calculateQualityMetrics(validations);

  return {
    total: metrics.totalRecords,
    valid: metrics.validRecords,
    warnings: metrics.warningRecords,
    errors: metrics.errorRecords + metrics.criticalRecords,
    score: metrics.totalRecords > 0
      ? ((metrics.validRecords + metrics.warningRecords) / metrics.totalRecords) * 100
      : 0
  };
}
