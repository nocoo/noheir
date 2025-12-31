/**
 * Asset Service - Supabase API layer for Capital Asset Management
 *
 * This service handles all CRUD operations for:
 * - Financial Products (product library)
 * - Capital Units (asset instances)
 * - Dashboard analytics
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
 * The available_date is when the unit becomes available for new deployment.
 * Formula: start_date + product.lock_period_days
 *
 * Rules:
 * - If no product: undefined (idle, available immediately)
 * - If no start_date: undefined
 * - If lock_period_days = 0: undefined (available immediately, e.g., "现金+")
 * - Otherwise: start_date + lock_period_days
 *
 * @param startDate - The start_date from the unit
 * @param product - The associated financial product
 * @returns Available date in YYYY-MM-DD format, or undefined if immediately available
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
        status: input.status || '投资中',
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
      return (data || []).map((row: any) => {
        const product = row.product as FinancialProduct | null;
        return {
          id: row.id,
          user_id: row.user_id,
          unit_code: row.unit_code,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          strategy: row.strategy,
          tactics: row.tactics,
          product_id: row.product_id,
          start_date: row.start_date,
          // Compute end_date from start_date + lock_period_days
          end_date: calculateAvailableDate(row.start_date, product),
          created_at: row.created_at,
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
    const updateData: any = {
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
    const units: UnitDisplayInfo[] = (data || []).map((row: any) => {
      const product = row.product as FinancialProduct | null;

      // Compute end_date from start_date + lock_period_days
      const endDate = calculateAvailableDate(row.start_date, product);

      const unit: CapitalUnitWithProduct = {
        id: row.id,
        user_id: row.user_id,
        unit_code: row.unit_code,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        strategy: row.strategy,
        tactics: row.tactics,
        product_id: row.product_id,
        start_date: row.start_date,
        end_date: endDate, // Computed, not from database
        created_at: row.created_at,
        product,
      };

      // Calculate display info
      let days_until_maturity: number | undefined;
      let is_overdue = false;

      if (endDate) {
        const endDateObj = new Date(endDate);
        days_until_maturity = daysBetween(today, endDateObj);
        is_overdue = days_until_maturity < 0;
      }

      return {
        ...unit,
        days_until_maturity,
        is_overdue,
      };
    });

    // Calculate dashboard metrics from the same data
    const total_units = units.length;
    const total_assets = units.reduce((sum, u) => sum + u.amount, 0);
    const idle_amount = units
      .filter(u => u.status === '已成立' && !u.product)
      .reduce((sum, u) => sum + u.amount, 0);
    const invested_amount = units
      .filter(u => u.product !== null)
      .reduce((sum, u) => sum + u.amount, 0);

    // Strategy allocation
    const strategyMap = new Map<string, { amount: number; count: number }>();
    units.forEach(u => {
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
    let is_overdue = false;

    if (endDate) {
      const endDateObj = new Date(endDate);
      days_until_maturity = daysBetween(today, endDateObj);
      is_overdue = days_until_maturity < 0;
    }

    return {
      ...unit,
      end_date: endDate, // Override with computed value
      days_until_maturity,
      is_overdue,
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
