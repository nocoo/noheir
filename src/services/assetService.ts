/**
 * Asset Service - Supabase API layer for Capital Asset Management
 *
 * This service handles all CRUD operations for:
 * - Financial Products (product library)
 * - Capital Units (asset instances)
 * - Dashboard analytics
 * - Data export/import (JSON)
 */

import { supabase } from '@/lib/supabase';
import type {
  FinancialProduct,
  CreateFinancialProductInput,
  UpdateFinancialProductInput,
  CapitalUnit,
  CreateCapitalUnitInput,
  UpdateCapitalUnitInput,
  DeployUnitInput,
  CapitalUnitWithProduct,
  AssetDashboard,
  StrategyAllocation,
  UpcomingMaturity,
  UnitDisplayInfo,
  UnitFilters,
  UnitSortBy,
  SortOrder,
  InvestmentStrategy,
  InvestmentTactics,
  Currency,
  ProductChannel,
  ProductCategory,
  UnitStatus,
} from '@/types/assets';
import { AssetServiceError } from '@/types/assets';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Handle Supabase errors and convert to AssetServiceError
 */
function handleSupabaseError(error: unknown, context: string): never {
  console.error(`[AssetService] ${context}:`, error);

  if (error && typeof error === 'object' && 'message' in error) {
    throw new AssetServiceError(
      `${context}: ${error.message}`,
      'SUPABASE_ERROR',
      error
    );
  }

  throw new AssetServiceError(
    `${context}: Unknown error`,
    'UNKNOWN_ERROR',
    error
  );
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Calculate available_date for a capital unit
 *
 * The available_date is when the lock period ends (start_date + product.lock_period_days).
 * After this date, the funds are still invested and earning interest, but become available for redeployment.
 *
 * IMPORTANT: This is NOT an "overdue" date - funds continue earning interest after available_date.
 * Instead, it represents liquidity tier:
 * - ✅ BEST: Already past available_date (funds available + earning interest)
 * - ⚠️ OK: Before available_date (still in lock period, earning interest)
 * - ❌ WORST: No product (completely idle, not earning anything)
 *
 * Rules:
 * - If no product: undefined (worst tier - completely idle funds)
 * - If no start_date: undefined
 * - If lock_period_days = 0: undefined (available immediately, e.g., "现金+")
 * - Otherwise: start_date + lock_period_days
 *
 * @param startDate - The start_date from the unit
 * @param product - The associated financial product
 * @returns Available date in YYYY-MM-DD format, or undefined if immediately available or no product
 */
function calculateAvailableDate(
  startDate: string | undefined | null,
  product: FinancialProduct | null
): string | undefined {
  // No product or no start date = idle/undefined = immediately available
  if (!startDate || !product) return undefined;

  // Zero lock period = immediately available (e.g., "现金+" products)
  if (product.lock_period_days <= 0) return undefined;

  // Calculate: start_date + lock_period_days
  const start = new Date(startDate);
  const available = new Date(start);
  available.setDate(available.getDate() + product.lock_period_days);

  return available.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ============================================================================
// FINANCIAL PRODUCTS API
// ============================================================================

/**
 * Fetch all financial products for the current user
 */
export async function fetchProducts(): Promise<FinancialProduct[]> {
  try {
    const { data, error } = await supabase
      .from('financial_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'Failed to fetch products');
  }
}

/**
 * Fetch a single product by ID
 */
export async function fetchProduct(id: string): Promise<FinancialProduct | null> {
  try {
    const { data, error } = await supabase
      .from('financial_products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Failed to fetch product');
  }
}

/**
 * Create a new financial product
 */
export async function createProduct(input: CreateFinancialProductInput): Promise<FinancialProduct> {
  try {
    const { data, error } = await supabase
      .from('financial_products')
      .insert({
        ...input,
        // Ensure required defaults
        currency: input.currency || 'CNY',
        lock_period_days: input.lock_period_days ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Failed to create product');
  }
}

/**
 * Update an existing financial product
 */
export async function updateProduct(
  id: string,
  input: UpdateFinancialProductInput
): Promise<FinancialProduct> {
  try {
    const { data, error } = await supabase
      .from('financial_products')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Failed to update product');
  }
}

/**
 * Delete a financial product
 */
export async function deleteProduct(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('financial_products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error, 'Failed to delete product');
  }
}

// ============================================================================
// CAPITAL UNITS API
// ============================================================================

/**
 * Fetch all capital units for the current user
 * Optionally includes joined product details
 *
 * NOTE: end_date is now computed on the frontend as available_date
 * Formula: start_date + product.lock_period_days
 */
export async function fetchUnits(withProducts: boolean = true): Promise<CapitalUnitWithProduct[]> {
  try {
    const query = supabase
      .from('capital_units')
      .select('*');

    if (withProducts) {
      // Use RPC call to get units with product details
      const { data, error } = await supabase
        .rpc('get_units_with_products');

      if (error) throw error;

      // Transform the result to match CapitalUnitWithProduct interface
      // The RPC returns product as a JSONB object
      return (data || []).map((row) => {
        const typedRow = row as CapitalUnitWithProduct & { product?: FinancialProduct | null };
        const product = typedRow.product ?? null;
        return {
          id: typedRow.id,
          user_id: typedRow.user_id,
          unit_code: typedRow.unit_code,
          amount: typedRow.amount,
          currency: typedRow.currency,
          status: typedRow.status,
          strategy: typedRow.strategy,
          tactics: typedRow.tactics,
          product_id: typedRow.product_id,
          start_date: typedRow.start_date,
          // Compute end_date from start_date + lock_period_days
          end_date: calculateAvailableDate(typedRow.start_date, product),
          note: typedRow.note,
          created_at: typedRow.created_at,
          product,
        };
      });
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'Failed to fetch units');
  }
}

/**
 * Fetch units with optional filtering and sorting
 */
export async function fetchUnitsFiltered(options: {
  filters?: UnitFilters;
  sortBy?: UnitSortBy;
  sortOrder?: SortOrder;
  withProducts?: boolean;
}): Promise<CapitalUnitWithProduct[]> {
  try {
    let query = supabase
      .from('capital_units')
      .select('*');

    // Apply filters
    const { filters, sortBy = 'created_at', sortOrder = 'desc' } = options;

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.strategy && filters.strategy.length > 0) {
      query = query.in('strategy', filters.strategy);
    }
    if (filters?.tactics && filters.tactics.length > 0) {
      query = query.in('tactics', filters.tactics);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error } = await query;

    if (error) throw error;

    // If products requested, fetch them separately and join
    if (options.withProducts && data) {
      const units = data as CapitalUnit[];
      const productIds = units
        .map(u => u.product_id)
        .filter((id): id is string => id !== null);

      const productsMap = new Map<string, FinancialProduct>();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('financial_products')
          .select('*')
          .in('id', productIds);

        products?.forEach(p => productsMap.set(p.id, p));
      }

      return units.map(unit => ({
        ...unit,
        product: unit.product_id ? productsMap.get(unit.product_id) || null : null,
      }));
    }

    return (data || []) as CapitalUnitWithProduct[];
  } catch (error) {
    handleSupabaseError(error, 'Failed to fetch units');
  }
}

/**
 * Fetch a single unit by ID
 */
export async function fetchUnit(id: string): Promise<CapitalUnitWithProduct | null> {
  try {
    const { data, error } = await supabase
      .from('capital_units')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Fetch product if linked
    let product: FinancialProduct | null = null;
    if (data.product_id) {
      const { data: pData } = await supabase
        .from('financial_products')
        .select('*')
        .eq('id', data.product_id)
        .maybeSingle();
      product = pData || null;
    }

    return { ...data, product };
  } catch (error) {
    handleSupabaseError(error, 'Failed to fetch unit');
  }
}

/**
 * Create a new capital unit (Mint)
 */
export async function createUnit(input: CreateCapitalUnitInput): Promise<CapitalUnit> {
  try {
    const { data, error } = await supabase
      .from('capital_units')
      .insert({
        ...input,
        // Ensure required defaults
        currency: input.currency || 'CNY',
        status: input.status || '已成立',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Failed to create unit');
  }
}

/**
 * Update an existing capital unit
 */
export async function updateUnit(
  id: string,
  input: UpdateCapitalUnitInput
): Promise<CapitalUnit> {
  try {
    const { data, error } = await supabase
      .from('capital_units')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Failed to update unit');
  }
}

/**
 * Delete a capital unit
 */
export async function deleteUnit(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('capital_units')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error, 'Failed to delete unit');
  }
}

/**
 * Deploy (invest) a unit to a product
 * This links the product and sets investment dates
 *
 * NOTE: end_date is NO LONGER stored in the database
 * It is computed on the frontend as: start_date + product.lock_period_days
 */
export async function deployUnit(
  unitId: string,
  input: DeployUnitInput & { strategy?: InvestmentStrategy; tactics?: InvestmentTactics }
): Promise<CapitalUnit> {
  try {
    // Verify unit exists and is in '已成立' status
    const { data: unit } = await supabase
      .from('capital_units')
      .select('status')
      .eq('id', unitId)
      .single();

    if (!unit) {
      throw new AssetServiceError('Unit not found', 'NOT_FOUND');
    }
    if (unit.status !== '已成立') {
      throw new AssetServiceError(
        `Unit cannot be deployed. Current status: ${unit.status}`,
        'INVALID_STATUS'
      );
    }

    // Prepare update data
    const updateData: Partial<CapitalUnit> = {
      product_id: input.product_id,
      start_date: input.start_date,
      status: '已成立',
    };

    // Add strategy and tactics if provided
    if (input.strategy) {
      updateData.strategy = input.strategy;
    }
    if (input.tactics) {
      updateData.tactics = input.tactics;
    }

    // Update unit with product, dates, and optionally strategy/tactics
    // end_date is computed on frontend: start_date + product.lock_period_days
    const { data, error } = await supabase
      .from('capital_units')
      .update(updateData)
      .eq('id', unitId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (error instanceof AssetServiceError) throw error;
    handleSupabaseError(error, 'Failed to deploy unit');
  }
}

/**
 * Recall (settle) a unit from a product
 * This clears the product link and resets status to '已成立'
 *
 * NOTE: end_date is NO LONGER stored in the database
 * It is computed on the frontend as: start_date + product.lock_period_days
 */
export async function recallUnit(unitId: string): Promise<CapitalUnit> {
  try {
    const { data, error } = await supabase
      .from('capital_units')
      .update({
        product_id: null,
        start_date: null,
        status: '已成立',
      })
      .eq('id', unitId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Failed to recall unit');
  }
}

/**
 * Archive a unit (soft delete via status change)
 *
 * NOTE: end_date is NO LONGER stored in the database
 * It is computed on the frontend as: start_date + product.lock_period_days
 */
export async function archiveUnit(unitId: string): Promise<CapitalUnit> {
  try {
    const { data, error } = await supabase
      .from('capital_units')
      .update({
        status: '已归档',
        product_id: null,
        start_date: null,
      })
      .eq('id', unitId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Failed to archive unit');
  }
}

// ============================================================================
// DASHBOARD & ANALYTICS API
// ============================================================================

/**
 * Capital Overview - Single query for all dashboard data
 * Combines dashboard metrics and unit display info in one API call
 *
 * NOTE: end_date is now computed on the frontend as available_date
 * Formula: start_date + product.lock_period_days
 */
export interface CapitalOverviewData {
  dashboard: AssetDashboard;
  units: UnitDisplayInfo[];
}

/**
 * Fetch complete capital overview data in a single query
 * This replaces separate fetchDashboard() and fetchUnitsDisplayInfo() calls
 */
export async function fetchCapitalOverview(): Promise<CapitalOverviewData> {
  try {
    // Single query to get all units with products
    const { data, error } = await supabase
      .rpc('get_units_with_products');

    if (error) throw error;

    const today = new Date();

    // Transform raw data to units with display info
    const units: UnitDisplayInfo[] = (data || []).map((row) => {
      const typedRow = row as CapitalUnitWithProduct & { product?: FinancialProduct | null };
      const product = typedRow.product ?? null;

      // Compute end_date from start_date + lock_period_days
      const endDate = calculateAvailableDate(typedRow.start_date, product);

      const unit: CapitalUnitWithProduct = {
        id: typedRow.id,
        user_id: typedRow.user_id,
        unit_code: typedRow.unit_code,
        amount: typedRow.amount,
        currency: typedRow.currency,
        status: typedRow.status,
        strategy: typedRow.strategy,
        tactics: typedRow.tactics,
        product_id: typedRow.product_id,
        start_date: typedRow.start_date,
        end_date: endDate, // Computed, not from database
        note: typedRow.note,
        created_at: typedRow.created_at,
        product,
      };

      // Calculate display info
      let days_until_maturity: number | undefined;
      let is_available = false;

      if (endDate) {
        const endDateObj = new Date(endDate);
        days_until_maturity = daysBetween(today, endDateObj);
        // Available means lock period has passed (funds available for redeployment + still earning interest)
        is_available = days_until_maturity < 0;
      }

      return {
        ...unit,
        days_until_maturity,
        is_available,
      };
    });

    // Calculate dashboard metrics from the same data
    // IMPORTANT: Only count units with status = '已成立' (established/active)
    // Units with status '计划中', '筹集中', '已归档' are excluded from asset calculations
    const activeUnits = units.filter(u => u.status === '已成立');

    const total_units = activeUnits.length;
    const total_assets = activeUnits.reduce((sum, u) => sum + u.amount, 0);
    const idle_amount = activeUnits
      .filter(u => !u.product)
      .reduce((sum, u) => sum + u.amount, 0);
    const invested_amount = activeUnits
      .filter(u => u.product !== null)
      .reduce((sum, u) => sum + u.amount, 0);

    // Strategy allocation (only for established units)
    const strategyMap = new Map<string, { amount: number; count: number }>();
    activeUnits.forEach(u => {
      const current = strategyMap.get(u.strategy) || { amount: 0, count: 0 };
      strategyMap.set(u.strategy, {
        amount: current.amount + u.amount,
        count: current.count + 1,
      });
    });

    const strategy_allocation: StrategyAllocation[] = Array.from(strategyMap.entries())
      .map(([strategy, { amount, count }]) => ({
        strategy: strategy as InvestmentStrategy,
        total_amount: amount,
        unit_count: count,
        percentage: total_assets > 0 ? (amount / total_assets) * 100 : 0,
      }))
      .sort((a, b) => b.total_amount - a.total_amount);

    // Upcoming maturities (next 30 days + overdue)
    const upcoming_maturities: UpcomingMaturity[] = units
      .filter(u => u.end_date && u.days_until_maturity !== undefined)
      .filter(u => u.days_until_maturity! <= 30)
      .map(u => ({
        unit_id: u.id,
        unit_code: u.unit_code,
        product_name: u.product?.name,
        end_date: u.end_date!,
        days_remaining: u.days_until_maturity!,
        amount: u.amount,
      }))
      .sort((a, b) => a.days_remaining - b.days_remaining);

    const dashboard: AssetDashboard = {
      total_units,
      total_assets,
      idle_amount,
      invested_amount,
      strategy_allocation,
      upcoming_maturities,
    };

    return { dashboard, units };
  } catch (error) {
    handleSupabaseError(error, 'Failed to fetch capital overview');
  }
}

/**
 * Fetch dashboard summary metrics
 * @deprecated Use fetchCapitalOverview() for better performance
 */
export async function fetchDashboard(): Promise<AssetDashboard> {
  const { dashboard } = await fetchCapitalOverview();
  return dashboard;
}

/**
 * Get units with computed display info (days until maturity, etc.)
 * @deprecated Use fetchCapitalOverview() for better performance
 */
export async function fetchUnitsDisplayInfo(
  options?: {
    filters?: UnitFilters;
    sortBy?: UnitSortBy;
    sortOrder?: SortOrder;
  }
): Promise<UnitDisplayInfo[]> {
  // If no filters, use the optimized path
  if (!options?.filters && !options?.sortBy) {
    const { units } = await fetchCapitalOverview();
    return units;
  }

  // With filters, use the filtered query
  const units = await fetchUnitsFiltered({
    ...options,
    withProducts: true,
  });

  const today = new Date();

  return units.map(unit => {
    // Compute end_date from start_date + lock_period_days
    const endDate = calculateAvailableDate(unit.start_date, unit.product);

    let days_until_maturity: number | undefined;
    let is_available = false;

    if (endDate) {
      const endDateObj = new Date(endDate);
      days_until_maturity = daysBetween(today, endDateObj);
      // Available means lock period has passed (funds available for redeployment + still earning interest)
      is_available = days_until_maturity < 0;
    }

    return {
      ...unit,
      end_date: endDate, // Override with computed value
      days_until_maturity,
      is_available,
    };
  });
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch create multiple units
 */
export async function batchCreateUnits(
  inputs: CreateCapitalUnitInput[]
): Promise<CapitalUnit[]> {
  try {
    const units = inputs.map(input => ({
      ...input,
      currency: input.currency || 'CNY',
      status: input.status || '已成立',
    }));

    const { data, error } = await supabase
      .from('capital_units')
      .insert(units)
      .select();

    if (error) throw error;
    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'Failed to batch create units');
  }
}

/**
 * Batch update unit statuses
 */
export async function batchUpdateUnitStatuses(
  unitIds: string[],
  status: CapitalUnit['status']
): Promise<void> {
  try {
    const { error } = await supabase
      .from('capital_units')
      .update({ status })
      .in('id', unitIds);

    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error, 'Failed to batch update unit statuses');
  }
}

// ============================================================================
// DATA EXPORT / IMPORT (JSON)
// ============================================================================

/**
 * Portable product record (stripped of system-generated fields)
 */
export interface ExportedProduct {
  name: string;
  code?: string;
  channel: string;
  category: string;
  currency: string;
  lock_period_days: number;
  annual_return_rate?: number;
}

/**
 * Portable unit record — references product by name instead of ID
 */
export interface ExportedUnit {
  unit_code: string;
  amount: number;
  currency: string;
  status: string;
  strategy: string;
  tactics: string;
  product_name?: string;    // Reference by name (resolved during import)
  start_date?: string;
  note?: string;
}

/**
 * Complete asset data export envelope
 */
export interface AssetExportData {
  version: 1;
  exported_at: string;
  products: ExportedProduct[];
  units: ExportedUnit[];
}

/**
 * Standalone product export envelope
 */
export interface ProductExportData {
  version: 1;
  type: 'products';
  exported_at: string;
  products: ExportedProduct[];
}

/**
 * Standalone unit export envelope
 */
export interface UnitExportData {
  version: 1;
  type: 'units';
  exported_at: string;
  units: ExportedUnit[];
}

/**
 * Import result with detailed reporting
 */
export interface AssetImportResult {
  products_created: number;
  units_created: number;
  errors: string[];
  warnings: string[];
}

/**
 * Single-domain import result
 */
export interface ProductImportResult {
  products_created: number;
  errors: string[];
  warnings: string[];
}

export interface UnitImportResult {
  units_created: number;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Validation helpers (reusable for import)
// ---------------------------------------------------------------------------

const VALID_CHANNELS: readonly string[] = [
  '招商银行', '平安银行', '微众银行', '支付宝', '招银香港', '光大永明', '中信建投',
];

const VALID_CATEGORIES: readonly string[] = [
  '养老年金', '储蓄保险', '混债基金', '债券基金', '货币基金',
  '股票基金', '指数基金', '宽基指数', '私募基金', '定期存款', '理财产品', '现金+',
];

const VALID_CURRENCIES: readonly string[] = ['CNY', 'USD', 'HKD'];

const VALID_STRATEGIES: readonly string[] = [
  '远期理财', '美元资产', '36存单', '长期理财', '短期理财', '中期理财', '进攻计划', '麻麻理财',
];

const VALID_TACTICS: readonly string[] = [
  '养老年金', '个人养老金', '定期存款', '理财产品', '现金产品',
  '债券基金', '偏股基金', '稳健理财', '增额寿险', '货币基金',
];

const VALID_STATUSES: readonly string[] = ['已成立', '计划中', '筹集中', '已归档'];

/**
 * Validate a product record, returning error messages (empty = valid)
 */
export function validateProduct(p: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `products[${index}]`;

  if (!p || typeof p !== 'object') {
    return [`${prefix}: not an object`];
  }

  const obj = p as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== 'string') {
    errors.push(`${prefix}: missing or invalid 'name'`);
  }
  if (!obj.channel || !VALID_CHANNELS.includes(obj.channel as string)) {
    errors.push(`${prefix}: invalid 'channel' "${obj.channel}" (expected: ${VALID_CHANNELS.join(', ')})`);
  }
  if (!obj.category || !VALID_CATEGORIES.includes(obj.category as string)) {
    errors.push(`${prefix}: invalid 'category' "${obj.category}" (expected: ${VALID_CATEGORIES.join(', ')})`);
  }
  if (obj.currency !== undefined && !VALID_CURRENCIES.includes(obj.currency as string)) {
    errors.push(`${prefix}: invalid 'currency' "${obj.currency}" (expected: ${VALID_CURRENCIES.join(', ')})`);
  }
  if (obj.lock_period_days !== undefined && (typeof obj.lock_period_days !== 'number' || obj.lock_period_days < 0)) {
    errors.push(`${prefix}: 'lock_period_days' must be a non-negative number`);
  }
  if (obj.annual_return_rate !== undefined && typeof obj.annual_return_rate !== 'number') {
    errors.push(`${prefix}: 'annual_return_rate' must be a number`);
  }

  return errors;
}

/**
 * Validate a unit record, returning error messages (empty = valid)
 */
export function validateUnit(u: unknown, index: number, productNames: Set<string>): string[] {
  const errors: string[] = [];
  const prefix = `units[${index}]`;

  if (!u || typeof u !== 'object') {
    return [`${prefix}: not an object`];
  }

  const obj = u as Record<string, unknown>;

  if (!obj.unit_code || typeof obj.unit_code !== 'string') {
    errors.push(`${prefix}: missing or invalid 'unit_code'`);
  }
  if (typeof obj.amount !== 'number' || obj.amount <= 0) {
    errors.push(`${prefix}: 'amount' must be a positive number`);
  }
  if (obj.currency !== undefined && !VALID_CURRENCIES.includes(obj.currency as string)) {
    errors.push(`${prefix}: invalid 'currency' "${obj.currency}"`);
  }
  if (obj.status !== undefined && !VALID_STATUSES.includes(obj.status as string)) {
    errors.push(`${prefix}: invalid 'status' "${obj.status}"`);
  }
  if (!obj.strategy || !VALID_STRATEGIES.includes(obj.strategy as string)) {
    errors.push(`${prefix}: invalid 'strategy' "${obj.strategy}" (expected: ${VALID_STRATEGIES.join(', ')})`);
  }
  if (!obj.tactics || !VALID_TACTICS.includes(obj.tactics as string)) {
    errors.push(`${prefix}: invalid 'tactics' "${obj.tactics}" (expected: ${VALID_TACTICS.join(', ')})`);
  }
  if (obj.product_name !== undefined && obj.product_name !== null) {
    if (typeof obj.product_name !== 'string') {
      errors.push(`${prefix}: 'product_name' must be a string`);
    } else if (!productNames.has(obj.product_name)) {
      errors.push(`${prefix}: product_name "${obj.product_name}" not found in products list`);
    }
  }
  if (obj.start_date !== undefined && obj.start_date !== null) {
    if (typeof obj.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(obj.start_date)) {
      errors.push(`${prefix}: 'start_date' must be YYYY-MM-DD format`);
    }
  }

  return errors;
}

/**
 * Export all products and units as a portable JSON structure.
 *
 * System-generated fields (id, user_id, created_at) are stripped.
 * Units reference products by name instead of ID for portability.
 */
export async function exportAssets(): Promise<AssetExportData> {
  try {
    // Fetch all products
    const { data: products, error: pErr } = await supabase
      .from('financial_products')
      .select('*')
      .order('created_at', { ascending: true });

    if (pErr) throw pErr;

    // Fetch all units with products (need product name for reference)
    const { data: rawUnits, error: uErr } = await supabase
      .rpc('get_units_with_products');

    if (uErr) throw uErr;

    // Build product ID -> name lookup
    const productMap = new Map<string, string>();
    (products || []).forEach((p: FinancialProduct) => productMap.set(p.id, p.name));

    // Transform products: strip system fields
    const exportedProducts: ExportedProduct[] = (products || []).map((p: FinancialProduct) => {
      const exported: ExportedProduct = {
        name: p.name,
        channel: p.channel,
        category: p.category,
        currency: p.currency,
        lock_period_days: p.lock_period_days,
      };
      if (p.code) exported.code = p.code;
      if (p.annual_return_rate !== undefined && p.annual_return_rate !== null) {
        exported.annual_return_rate = p.annual_return_rate;
      }
      return exported;
    });

    // Transform units: strip system fields, replace product_id with product_name
    const exportedUnits: ExportedUnit[] = (rawUnits || []).map((row: CapitalUnitWithProduct) => {
      const exported: ExportedUnit = {
        unit_code: row.unit_code,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        strategy: row.strategy,
        tactics: row.tactics,
      };
      if (row.product_id) {
        exported.product_name = productMap.get(row.product_id);
      }
      if (row.start_date) exported.start_date = row.start_date;
      if (row.note) exported.note = row.note;
      return exported;
    });

    return {
      version: 1,
      exported_at: new Date().toISOString(),
      products: exportedProducts,
      units: exportedUnits,
    };
  } catch (error) {
    handleSupabaseError(error, 'Failed to export assets');
  }
}

/**
 * Parse and validate a JSON string as asset export data.
 * Returns the parsed data or throws with validation errors.
 */
export function parseAssetJSON(jsonString: string): { data: AssetExportData; warnings: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new AssetServiceError('Invalid JSON format', 'PARSE_ERROR');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AssetServiceError('JSON must be an object', 'PARSE_ERROR');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new AssetServiceError(
      `Unsupported export version: ${obj.version} (expected 1)`,
      'VERSION_ERROR'
    );
  }

  if (!Array.isArray(obj.products)) {
    throw new AssetServiceError('Missing or invalid "products" array', 'PARSE_ERROR');
  }

  if (!Array.isArray(obj.units)) {
    throw new AssetServiceError('Missing or invalid "units" array', 'PARSE_ERROR');
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate products
  const productNames = new Set<string>();
  for (let i = 0; i < obj.products.length; i++) {
    const pErrors = validateProduct(obj.products[i], i);
    errors.push(...pErrors);
    const name = (obj.products[i] as Record<string, unknown>)?.name;
    if (typeof name === 'string') {
      if (productNames.has(name)) {
        warnings.push(`products[${i}]: duplicate product name "${name}"`);
      }
      productNames.add(name);
    }
  }

  // Validate units
  for (let i = 0; i < obj.units.length; i++) {
    const uErrors = validateUnit(obj.units[i], i, productNames);
    errors.push(...uErrors);
  }

  if (errors.length > 0) {
    throw new AssetServiceError(
      `Validation failed with ${errors.length} error(s):\n${errors.join('\n')}`,
      'VALIDATION_ERROR',
      errors
    );
  }

  return {
    data: parsed as AssetExportData,
    warnings,
  };
}

/**
 * Import assets from a parsed export data structure.
 *
 * Strategy:
 * 1. Insert products first (they have no dependencies)
 * 2. Build a name -> new_id map from inserted products
 * 3. Insert units, resolving product_name to product_id
 *
 * This does NOT delete existing data — it adds to it.
 * Call deleteAllProducts() / deleteAllUnits() first if you want a clean import.
 */
export async function importAssets(data: AssetExportData): Promise<AssetImportResult> {
  const result: AssetImportResult = {
    products_created: 0,
    units_created: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Step 1: Insert products
    const productNameToId = new Map<string, string>();

    if (data.products.length > 0) {
      const productRecords = data.products.map(p => ({
        name: p.name,
        code: p.code || null,
        channel: p.channel as ProductChannel,
        category: p.category as ProductCategory,
        currency: (p.currency || 'CNY') as Currency,
        lock_period_days: p.lock_period_days ?? 0,
        annual_return_rate: p.annual_return_rate ?? null,
      }));

      const { data: inserted, error } = await supabase
        .from('financial_products')
        .insert(productRecords)
        .select();

      if (error) {
        result.errors.push(`Failed to insert products: ${error.message}`);
        return result;
      }

      (inserted || []).forEach((p: FinancialProduct) => {
        productNameToId.set(p.name, p.id);
      });
      result.products_created = inserted?.length || 0;
    }

    // Step 2: Insert units
    if (data.units.length > 0) {
      const unitRecords = data.units.map(u => {
        let product_id: string | null = null;
        if (u.product_name) {
          product_id = productNameToId.get(u.product_name) || null;
          if (!product_id) {
            result.warnings.push(
              `Unit "${u.unit_code}": product "${u.product_name}" not found in import, setting product_id to null`
            );
          }
        }

        return {
          unit_code: u.unit_code,
          amount: u.amount,
          currency: (u.currency || 'CNY') as Currency,
          status: (u.status || '已成立') as UnitStatus,
          strategy: u.strategy as InvestmentStrategy,
          tactics: u.tactics as InvestmentTactics,
          product_id,
          start_date: u.start_date || null,
          note: u.note || null,
        };
      });

      // Batch insert in chunks of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < unitRecords.length; i += BATCH_SIZE) {
        const batch = unitRecords.slice(i, i + BATCH_SIZE);
        const { data: inserted, error } = await supabase
          .from('capital_units')
          .insert(batch)
          .select();

        if (error) {
          result.errors.push(`Failed to insert units batch ${i / BATCH_SIZE + 1}: ${error.message}`);
          continue;
        }
        result.units_created += inserted?.length || 0;
      }
    }

    return result;
  } catch (error) {
    if (error instanceof AssetServiceError) throw error;
    handleSupabaseError(error, 'Failed to import assets');
  }
}

// ============================================================================
// SEPARATE PRODUCT / UNIT EXPORT / IMPORT
// ============================================================================

/**
 * Export only products as a standalone JSON structure.
 */
export async function exportProducts(): Promise<ProductExportData> {
  try {
    const { data: products, error } = await supabase
      .from('financial_products')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const exportedProducts: ExportedProduct[] = (products || []).map((p: FinancialProduct) => {
      const exported: ExportedProduct = {
        name: p.name,
        channel: p.channel,
        category: p.category,
        currency: p.currency,
        lock_period_days: p.lock_period_days,
      };
      if (p.code) exported.code = p.code;
      if (p.annual_return_rate !== undefined && p.annual_return_rate !== null) {
        exported.annual_return_rate = p.annual_return_rate;
      }
      return exported;
    });

    return {
      version: 1,
      type: 'products',
      exported_at: new Date().toISOString(),
      products: exportedProducts,
    };
  } catch (error) {
    handleSupabaseError(error, 'Failed to export products');
  }
}

/**
 * Export only units as a standalone JSON structure.
 * Units reference products by name for portability.
 */
export async function exportUnits(): Promise<UnitExportData> {
  try {
    // Need product map for name resolution
    const { data: products, error: pErr } = await supabase
      .from('financial_products')
      .select('id, name');

    if (pErr) throw pErr;

    const productMap = new Map<string, string>();
    (products || []).forEach((p: { id: string; name: string }) => productMap.set(p.id, p.name));

    const { data: rawUnits, error: uErr } = await supabase
      .rpc('get_units_with_products');

    if (uErr) throw uErr;

    const exportedUnits: ExportedUnit[] = (rawUnits || []).map((row: CapitalUnitWithProduct) => {
      const exported: ExportedUnit = {
        unit_code: row.unit_code,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        strategy: row.strategy,
        tactics: row.tactics,
      };
      if (row.product_id) {
        exported.product_name = productMap.get(row.product_id);
      }
      if (row.start_date) exported.start_date = row.start_date;
      if (row.note) exported.note = row.note;
      return exported;
    });

    return {
      version: 1,
      type: 'units',
      exported_at: new Date().toISOString(),
      units: exportedUnits,
    };
  } catch (error) {
    handleSupabaseError(error, 'Failed to export units');
  }
}

/**
 * Parse and validate a product-only JSON export.
 */
export function parseProductJSON(jsonString: string): { data: ProductExportData; warnings: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new AssetServiceError('Invalid JSON format', 'PARSE_ERROR');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AssetServiceError('JSON must be an object', 'PARSE_ERROR');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new AssetServiceError(
      `Unsupported export version: ${obj.version} (expected 1)`,
      'VERSION_ERROR'
    );
  }

  if (obj.type !== 'products') {
    throw new AssetServiceError(
      `Expected type "products" but got "${obj.type}"`,
      'PARSE_ERROR'
    );
  }

  if (!Array.isArray(obj.products)) {
    throw new AssetServiceError('Missing or invalid "products" array', 'PARSE_ERROR');
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const productNames = new Set<string>();

  for (let i = 0; i < obj.products.length; i++) {
    const pErrors = validateProduct(obj.products[i], i);
    errors.push(...pErrors);
    const name = (obj.products[i] as Record<string, unknown>)?.name;
    if (typeof name === 'string') {
      if (productNames.has(name)) {
        warnings.push(`products[${i}]: duplicate product name "${name}"`);
      }
      productNames.add(name);
    }
  }

  if (errors.length > 0) {
    throw new AssetServiceError(
      `Validation failed with ${errors.length} error(s):\n${errors.join('\n')}`,
      'VALIDATION_ERROR',
      errors
    );
  }

  return {
    data: parsed as ProductExportData,
    warnings,
  };
}

/**
 * Parse and validate a unit-only JSON export.
 * Note: product_name references are NOT validated here since products may already exist in DB.
 * We use a permissive product name set that accepts any string.
 */
export function parseUnitJSON(jsonString: string): { data: UnitExportData; warnings: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new AssetServiceError('Invalid JSON format', 'PARSE_ERROR');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AssetServiceError('JSON must be an object', 'PARSE_ERROR');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new AssetServiceError(
      `Unsupported export version: ${obj.version} (expected 1)`,
      'VERSION_ERROR'
    );
  }

  if (obj.type !== 'units') {
    throw new AssetServiceError(
      `Expected type "units" but got "${obj.type}"`,
      'PARSE_ERROR'
    );
  }

  if (!Array.isArray(obj.units)) {
    throw new AssetServiceError('Missing or invalid "units" array', 'PARSE_ERROR');
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Use a permissive set: accept any product_name since products may already be in DB
  const permissiveProductNames = new Proxy(new Set<string>(), {
    get(target, prop) {
      if (prop === 'has') return () => true;
      return Reflect.get(target, prop);
    },
  }) as Set<string>;

  for (let i = 0; i < obj.units.length; i++) {
    const uErrors = validateUnit(obj.units[i], i, permissiveProductNames);
    errors.push(...uErrors);
  }

  if (errors.length > 0) {
    throw new AssetServiceError(
      `Validation failed with ${errors.length} error(s):\n${errors.join('\n')}`,
      'VALIDATION_ERROR',
      errors
    );
  }

  return {
    data: parsed as UnitExportData,
    warnings,
  };
}

/**
 * Import products from a standalone product export.
 */
export async function importProducts(data: ProductExportData): Promise<ProductImportResult> {
  const result: ProductImportResult = {
    products_created: 0,
    errors: [],
    warnings: [],
  };

  try {
    if (data.products.length === 0) {
      result.warnings.push('No products to import');
      return result;
    }

    const productRecords = data.products.map(p => ({
      name: p.name,
      code: p.code || null,
      channel: p.channel as ProductChannel,
      category: p.category as ProductCategory,
      currency: (p.currency || 'CNY') as Currency,
      lock_period_days: p.lock_period_days ?? 0,
      annual_return_rate: p.annual_return_rate ?? null,
    }));

    const { data: inserted, error } = await supabase
      .from('financial_products')
      .insert(productRecords)
      .select();

    if (error) {
      result.errors.push(`Failed to insert products: ${error.message}`);
      return result;
    }

    result.products_created = inserted?.length || 0;
    return result;
  } catch (error) {
    if (error instanceof AssetServiceError) throw error;
    handleSupabaseError(error, 'Failed to import products');
  }
}

/**
 * Import units from a standalone unit export.
 * Resolves product_name to product_id by looking up existing products in DB.
 */
export async function importUnits(data: UnitExportData): Promise<UnitImportResult> {
  const result: UnitImportResult = {
    units_created: 0,
    errors: [],
    warnings: [],
  };

  try {
    if (data.units.length === 0) {
      result.warnings.push('No units to import');
      return result;
    }

    // Look up existing products to resolve product_name -> product_id
    const { data: products, error: pErr } = await supabase
      .from('financial_products')
      .select('id, name');

    if (pErr) {
      result.errors.push(`Failed to look up products: ${pErr.message}`);
      return result;
    }

    const productNameToId = new Map<string, string>();
    (products || []).forEach((p: { id: string; name: string }) => {
      productNameToId.set(p.name, p.id);
    });

    const unitRecords = data.units.map(u => {
      let product_id: string | null = null;
      if (u.product_name) {
        product_id = productNameToId.get(u.product_name) || null;
        if (!product_id) {
          result.warnings.push(
            `Unit "${u.unit_code}": product "${u.product_name}" not found in database, setting product_id to null`
          );
        }
      }

      return {
        unit_code: u.unit_code,
        amount: u.amount,
        currency: (u.currency || 'CNY') as Currency,
        status: (u.status || '已成立') as UnitStatus,
        strategy: u.strategy as InvestmentStrategy,
        tactics: u.tactics as InvestmentTactics,
        product_id,
        start_date: u.start_date || null,
        note: u.note || null,
      };
    });

    const BATCH_SIZE = 100;
    for (let i = 0; i < unitRecords.length; i += BATCH_SIZE) {
      const batch = unitRecords.slice(i, i + BATCH_SIZE);
      const { data: inserted, error } = await supabase
        .from('capital_units')
        .insert(batch)
        .select();

      if (error) {
        result.errors.push(`Failed to insert units batch ${i / BATCH_SIZE + 1}: ${error.message}`);
        continue;
      }
      result.units_created += inserted?.length || 0;
    }

    return result;
  } catch (error) {
    if (error instanceof AssetServiceError) throw error;
    handleSupabaseError(error, 'Failed to import units');
  }
}
