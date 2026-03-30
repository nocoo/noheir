/**
 * Capital Unit CRUD tool handlers
 *
 * Provides list, get, create, update, delete operations for capital_units.
 * Each function takes an authenticated SupabaseClient and typed params,
 * returns a structured result object.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface UnitRow {
  id: string;
  unit_code: string;
  amount: number;
  currency: string;
  status: string;
  strategy: string | null;
  tactics: string | null;
  product_id: string | null;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  created_at: string;
}

export interface UnitWithProductRow extends UnitRow {
  product: {
    id: string;
    name: string;
    code: string | null;
    channel: string | null;
    category: string | null;
    currency: string;
    lock_period_days: number;
    annual_return_rate: number | null;
    created_at: string;
  } | null;
}

export interface ListUnitsParams {
  status?: string;
  strategy?: string;
  tactics?: string;
  currency?: string;
  with_products?: boolean;
}

export interface ListUnitsResult {
  units: (UnitRow | UnitWithProductRow)[];
  total_returned: number;
}

export interface GetUnitParams {
  id: string;
  with_product?: boolean;
}

export interface GetUnitResult {
  unit: (UnitRow | UnitWithProductRow) | null;
}

export interface CreateUnitParams {
  unit_code: string;
  amount: number;
  strategy: string;
  tactics: string;
  currency?: string;
  status?: string;
  product_id?: string;
  start_date?: string;
  end_date?: string;
  note?: string;
}

export interface CreateUnitResult {
  unit: UnitRow;
}

export interface UpdateUnitParams {
  id: string;
  unit_code?: string;
  amount?: number;
  currency?: string;
  status?: string;
  strategy?: string;
  tactics?: string;
  product_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  note?: string | null;
}

export interface UpdateUnitResult {
  unit: UnitRow;
}

export interface DeleteUnitParams {
  id: string;
}

export interface DeleteUnitResult {
  success: boolean;
}

// ============================================================================
// Handlers
// ============================================================================

export async function listUnits(
  client: SupabaseClient,
  params: ListUnitsParams,
): Promise<ListUnitsResult> {
  // When with_products is true, use the RPC for joined data
  if (params.with_products) {
    const { data, error } = await client.rpc("get_units_with_products");

    if (error) {
      throw new Error(`get_units_with_products RPC failed: ${error.message}`);
    }

    let units = (data ?? []) as UnitWithProductRow[];

    // Apply client-side filters on RPC results
    if (params.status !== undefined) units = units.filter((u) => u.status === params.status);
    if (params.strategy !== undefined) units = units.filter((u) => u.strategy === params.strategy);
    if (params.tactics !== undefined) units = units.filter((u) => u.tactics === params.tactics);
    if (params.currency !== undefined) units = units.filter((u) => u.currency === params.currency);

    return { units, total_returned: units.length };
  }

  // Without products: direct table query with server-side filters
  let query = client.from("capital_units").select("*");

  if (params.status !== undefined) query = query.eq("status", params.status);
  if (params.strategy !== undefined) query = query.eq("strategy", params.strategy);
  if (params.tactics !== undefined) query = query.eq("tactics", params.tactics);
  if (params.currency !== undefined) query = query.eq("currency", params.currency);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`list capital_units failed: ${error.message}`);
  }

  const units = (data ?? []) as UnitRow[];
  return { units, total_returned: units.length };
}

export async function getUnit(
  client: SupabaseClient,
  params: GetUnitParams,
): Promise<GetUnitResult> {
  if (params.with_product) {
    // Use RPC and filter by id client-side
    const { data, error } = await client.rpc("get_units_with_products");

    if (error) {
      throw new Error(`get_units_with_products RPC failed: ${error.message}`);
    }

    const units = (data ?? []) as UnitWithProductRow[];
    const unit = units.find((u) => u.id === params.id) ?? null;
    return { unit };
  }

  const { data, error } = await client
    .from("capital_units")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    throw new Error(`get capital_unit failed: ${error.message}`);
  }

  return { unit: (data as UnitRow) ?? null };
}

export async function createUnit(
  client: SupabaseClient,
  params: CreateUnitParams,
): Promise<CreateUnitResult> {
  const insertData: Record<string, unknown> = {
    unit_code: params.unit_code,
    amount: params.amount,
    strategy: params.strategy,
    tactics: params.tactics,
  };

  if (params.currency !== undefined) insertData.currency = params.currency;
  if (params.status !== undefined) insertData.status = params.status;
  if (params.product_id !== undefined) insertData.product_id = params.product_id;
  if (params.start_date !== undefined) insertData.start_date = params.start_date;
  if (params.end_date !== undefined) insertData.end_date = params.end_date;
  if (params.note !== undefined) insertData.note = params.note;

  const { data, error } = await client
    .from("capital_units")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`create capital_unit failed: ${error.message}`);
  }

  return { unit: data as UnitRow };
}

export async function updateUnit(
  client: SupabaseClient,
  params: UpdateUnitParams,
): Promise<UpdateUnitResult> {
  const updateData: Record<string, unknown> = {};

  if (params.unit_code !== undefined) updateData.unit_code = params.unit_code;
  if (params.amount !== undefined) updateData.amount = params.amount;
  if (params.currency !== undefined) updateData.currency = params.currency;
  if (params.status !== undefined) updateData.status = params.status;
  if (params.strategy !== undefined) updateData.strategy = params.strategy;
  if (params.tactics !== undefined) updateData.tactics = params.tactics;
  // Allow null for clearing product association
  if (params.product_id !== undefined) updateData.product_id = params.product_id;
  if (params.start_date !== undefined) updateData.start_date = params.start_date;
  if (params.end_date !== undefined) updateData.end_date = params.end_date;
  if (params.note !== undefined) updateData.note = params.note;

  if (Object.keys(updateData).length === 0) {
    throw new Error("update capital_unit failed: no fields to update");
  }

  const { data, error } = await client
    .from("capital_units")
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`update capital_unit failed: ${error.message}`);
  }

  return { unit: data as UnitRow };
}

export async function deleteUnit(
  client: SupabaseClient,
  params: DeleteUnitParams,
): Promise<DeleteUnitResult> {
  const { error } = await client
    .from("capital_units")
    .delete()
    .eq("id", params.id);

  if (error) {
    throw new Error(`delete capital_unit failed: ${error.message}`);
  }

  return { success: true };
}
