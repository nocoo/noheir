/**
 * Capital Asset Management Types
 * Based on the "Unit-based" asset management philosophy
 *
 * IMPORTANT: All enum values MUST match the database CHECK constraints exactly.
 */

// ============================================================================
// ENUMS - Strict enum values matching the database schema
// ============================================================================

/**
 * Distribution Channel - Where the product is sold/purchased
 * Matches: channel text check (channel in (...))
 */
export type ProductChannel =
  | '招商银行'
  | '平安银行'
  | '微众银行'
  | '支付宝'
  | '招银香港'
  | '光大永明'
  | '中信建投';

/**
 * Product Category - Type of financial product
 * Matches: category text check (category in (...))
 */
export type ProductCategory =
  | '养老年金'
  | '储蓄保险'
  | '混债基金'
  | '债券基金'
  | '货币基金'
  | '股票基金'
  | '指数基金'
  | '宽基指数'
  | '私募基金'
  | '定期存款'
  | '理财产品'
  | '现金+';

/**
 * Investment Strategy - High-level strategic allocation
 * Matches: strategy text check (strategy in (...))
 */
export type InvestmentStrategy =
  | '远期理财'
  | '美元资产'
  | '36存单'
  | '长期理财'
  | '短期理财'
  | '中期理财'
  | '进攻计划'
  | '麻麻理财';

/**
 * Investment Tactics - Specific tactical approach
 * Matches: tactics text check (tactics in (...))
 */
export type InvestmentTactics =
  | '养老年金'
  | '个人养老金'
  | '定期存款'
  | '理财产品'
  | '现金产品'
  | '债券基金'
  | '偏股基金'
  | '稳健理财'
  | '增额寿险'
  | '货币基金';

/**
 * Unit Status - Current state of a capital unit
 * Matches: status text check (status in (...))
 */
export type UnitStatus =
  | '已成立'   // Idle - Available for deployment (including those with end_date)
  | '计划中'   // Planned
  | '筹集中'   // Raising
  | '已归档';  // Archived

// ============================================================================
// CURRENCY TYPE
// ============================================================================

/**
 * Supported currencies
 */
export type Currency = 'CNY' | 'USD' | 'HKD';

// ============================================================================
// FINANCIAL PRODUCT TYPES
// ============================================================================

/**
 * Financial Product - The definition/template of an investment product
 * These are the "products" available in the market that units can be invested in
 *
 * DB Schema: financial_products
 */
export interface FinancialProduct {
  id: string;                    // UUID primary key
  user_id: string;               // User ID (RLS, references auth.users)

  // Basic Info
  name: string;                  // Product name (NOT NULL)
  code?: string;                 // Optional product code

  // Categorization (ENUMs - CHECK constraints)
  channel: ProductChannel;       // Distribution channel
  category: ProductCategory;     // Product category

  // Currency
  currency: Currency;            // Default: 'CNY'

  // Investment Terms
  lock_period_days: number;      // Lock period in days (default: 0)
  annual_return_rate?: number;   // Annual return rate (e.g., 3.50 for 3.50%)

  // Timestamps
  created_at: string;            // timestamptz
}

/**
 * Input type for creating a new financial product
 */
export interface CreateFinancialProductInput {
  name: string;
  code?: string;
  channel: ProductChannel;
  category: ProductCategory;
  currency?: Currency;
  lock_period_days?: number;
  annual_return_rate?: number;
}

/**
 * Input type for updating a financial product
 */
export interface UpdateFinancialProductInput {
  name?: string;
  code?: string;
  channel?: ProductChannel;
  category?: ProductCategory;
  currency?: Currency;
  lock_period_days?: number;
  annual_return_rate?: number;
}

// ============================================================================
// CAPITAL UNIT TYPES
// ============================================================================

/**
 * Capital Unit - An instance of capital (e.g., 50,000 CNY) identified by a code
 * These are the actual "chunks" of money that get deployed to products
 *
 * DB Schema: capital_units
 */
export interface CapitalUnit {
  id: string;                    // UUID primary key
  user_id: string;               // User ID (RLS, references auth.users)

  // Identity
  unit_code: string;             // Unit code (NOT NULL, e.g., "E01", "E02")

  // Capital (IMMUTABLE)
  amount: number;                // The principal amount (NOT NULL, numeric(12,2))
  currency: Currency;            // Default: 'CNY'

  // Current Status (ENUM - CHECK constraint)
  status: UnitStatus;            // Default: '已成立'

  // Strategy Classification (ENUMs - CHECK constraints)
  strategy: InvestmentStrategy;  // Strategic allocation
  tactics: InvestmentTactics;    // Tactical approach

  // Product Association
  product_id?: string;           // FK to financial_products(id), nullable

  // Investment Period (when locked to a product)
  start_date?: string;           // date, nullable
  end_date?: string;             // date, nullable

  // Timestamps
  created_at: string;            // timestamptz
}

/**
 * Input type for creating a new capital unit
 */
export interface CreateCapitalUnitInput {
  unit_code: string;             // e.g., "E01"
  amount: number;                // e.g., 50000
  currency?: Currency;
  status?: UnitStatus;           // Default: '已成立'
  strategy: InvestmentStrategy;
  tactics: InvestmentTactics;
  product_id?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * Input type for updating a capital unit
 */
export interface UpdateCapitalUnitInput {
  unit_code?: string;
  amount?: number;
  currency?: Currency;
  status?: UnitStatus;
  strategy?: InvestmentStrategy;
  tactics?: InvestmentTactics;
  product_id?: string | null;    // Set to null to recall from product
  start_date?: string | null;
  end_date?: string | null;
}

/**
 * Input type for deploying (investing) a unit
 * Links an idle unit to a product with investment dates
 */
export interface DeployUnitInput {
  product_id: string;            // Target product
  start_date: string;            // Investment start date (YYYY-MM-DD)
  end_date: string;              // Expected maturity date (YYYY-MM-DD)
}

/**
 * Input type for recalling (settling) a unit
 * Unlinks a unit from its product, making it idle again
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RecallUnitInput {}

// ============================================================================
// DASHBOARD & ANALYTICS TYPES
// ============================================================================

/**
 * Asset allocation by strategy
 */
export interface StrategyAllocation {
  strategy: InvestmentStrategy;
  total_amount: number;
  unit_count: number;
  percentage: number;
}

/**
 * Upcoming maturity alert
 */
export interface UpcomingMaturity {
  unit_id: string;
  unit_code: string;
  product_name?: string;
  end_date: string;
  days_remaining: number;
  amount: number;
}

/**
 * Dashboard summary metrics
 */
export interface AssetDashboard {
  total_units: number;
  total_assets: number;
  idle_amount: number;
  invested_amount: number;
  strategy_allocation: StrategyAllocation[];
  upcoming_maturities: UpcomingMaturity[];
}

// ============================================================================
// FILTER & SORT TYPES
// ============================================================================

export interface UnitFilters {
  status?: UnitStatus[];
  strategy?: InvestmentStrategy[];
  tactics?: InvestmentTactics[];
}

export type UnitSortBy =
  | 'unit_code'
  | 'amount'
  | 'status'
  | 'strategy'
  | 'end_date'
  | 'created_at';

export type SortOrder = 'asc' | 'desc';

// ============================================================================
// JOIN RESULTS (Unit with Product details)
// ============================================================================

/**
 * Capital Unit with joined Product details
 */
export interface CapitalUnitWithProduct extends CapitalUnit {
  product?: FinancialProduct | null;
}

/**
 * Extended unit info for display
 */
export interface UnitDisplayInfo extends CapitalUnitWithProduct {
  days_until_maturity?: number;
  is_overdue?: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AssetServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AssetServiceError';
  }
}
