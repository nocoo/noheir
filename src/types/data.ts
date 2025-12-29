/**
 * Raw CSV row structure matching the actual data format
 * 日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
 * Note: 交易分类 = primary category, 交易类型 = tertiary category
 * Secondary category will be derived from mapping based on tertiary category
 */
export interface RawCSVRow {
  date: string;           // YYYY-MM-DD
  primaryCategory: string; // 交易分类 (一级分类)
  tertiaryCategory: string; // 交易类型 (三级分类)
  inflow: string;         // 流入金额
  outflow: string;        // 流出金额
  currency: string;       // 币种
  account: string;        // 资金账户
  tags: string;           // 标签 (comma separated)
  note: string;           // 备注
}

/**
 * Parsed transaction with validation status
 */
export interface ParsedTransaction {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  primaryCategory: string;   // 一级分类
  secondaryCategory: string; // 二级分类 (derived from tertiary via mapping)
  tertiaryCategory: string;  // 三级分类 (from CSV column 交易类型)
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  account: string;
  currency: string;
  tags: string[];
  note?: string;
  rawIndex: number; // Original row index for traceability
  hasSecondaryMapping: boolean; // Whether secondary category was successfully mapped
}

/**
 * Validation result for a single field
 */
export interface FieldValidation {
  field: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validation result for a transaction
 */
export interface TransactionValidation {
  transaction: ParsedTransaction;
  isValid: boolean;
  fields: Record<string, FieldValidation>;
  errors: string[];
  warnings: string[];
  severity: 'valid' | 'warning' | 'error' | 'critical';
}

/**
 * Data quality metrics
 */
export interface DataQualityMetrics {
  totalRecords: number;
  validRecords: number;
  warningRecords: number;
  errorRecords: number;
  criticalRecords: number;

  // Field completeness
  dateCompleteness: number;
  categoryCompleteness: number;
  amountCompleteness: number;
  accountCompleteness: number;

  // Data integrity
  missingDates: number;
  futureDates: number;
  negativeAmounts: number;
  zeroAmounts: number;

  // Category mapping
  missingSecondaryMappings: number; // Records where tertiary->secondary mapping failed
  unmappedTertiaryCategories: string[]; // List of tertiary categories without mapping

  // Statistics
  dateRange: { start: string; end: string } | null;
  years: number[];
  months: number[];
  accounts: string[];
  primaryCategories: string[];
  secondaryCategories: string[];
  tertiaryCategories: string[];
  currencies: string[];

  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpense: number;
}

/**
 * Cleaned transaction ready for analysis
 */
export interface CleanedTransaction extends ParsedTransaction {
  validatedAt: Date;
  validationSeverity: 'valid' | 'warning' | 'error' | 'critical';
}

/**
 * Aggregated data by various dimensions
 */
export interface AggregatedByCategory {
  category: string;
  totalAmount: number;
  count: number;
  averageAmount: number;
  percentage: number;
  subcategories: AggregatedBySubcategory[];
}

export interface AggregatedBySubcategory {
  subcategory: string;
  totalAmount: number;
  count: number;
  averageAmount: number;
  percentage: number;
}

export interface AggregatedByAccount {
  account: string;
  income: number;
  expense: number;
  balance: number;
  count: number;
}

export interface AggregatedByMonth {
  year: number;
  month: number;
  monthLabel: string;
  income: number;
  expense: number;
  balance: number;
  count: number;
}

/**
 * Data layer types
 */
export type DataLayerType = 'raw' | 'parsed' | 'validated' | 'cleaned' | 'aggregated';

/**
 * Import session tracking
 */
export interface ImportSession {
  id: string;
  timestamp: Date;
  fileName: string;
  fileSize: number;
  rowCount: number;
  metrics: DataQualityMetrics;
  layers: {
    raw: ParsedTransaction[];
    validated: TransactionValidation[];
    cleaned: CleanedTransaction[];
  };
}
