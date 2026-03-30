/**
 * Product CRUD tool handlers
 *
 * Provides list, get, create, update, delete operations for financial_products.
 * Each function takes an authenticated SupabaseClient and typed params,
 * returns a structured result object.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface ProductRow {
  id: string;
  name: string;
  code: string | null;
  channel: string | null;
  category: string | null;
  currency: string;
  lock_period_days: number;
  annual_return_rate: number | null;
  created_at: string;
}

export interface ListProductsParams {
  channel?: string;
  category?: string;
  currency?: string;
}

export interface ListProductsResult {
  products: ProductRow[];
  total_returned: number;
}

export interface GetProductParams {
  id: string;
}

export interface GetProductResult {
  product: ProductRow | null;
}

export interface CreateProductParams {
  name: string;
  code?: string;
  channel: string;
  category: string;
  currency?: string;
  lock_period_days?: number;
  annual_return_rate?: number;
}

export interface CreateProductResult {
  product: ProductRow;
}

export interface UpdateProductParams {
  id: string;
  name?: string;
  code?: string;
  channel?: string;
  category?: string;
  currency?: string;
  lock_period_days?: number;
  annual_return_rate?: number;
}

export interface UpdateProductResult {
  product: ProductRow;
}

export interface DeleteProductParams {
  id: string;
}

export interface DeleteProductResult {
  success: boolean;
}

// ============================================================================
// Handlers
// ============================================================================

export async function listProducts(
  client: SupabaseClient,
  params: ListProductsParams,
): Promise<ListProductsResult> {
  let query = client.from("financial_products").select("*");

  if (params.channel !== undefined) query = query.eq("channel", params.channel);
  if (params.category !== undefined) query = query.eq("category", params.category);
  if (params.currency !== undefined) query = query.eq("currency", params.currency);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`list financial_products failed: ${error.message}`);
  }

  const products = (data ?? []) as ProductRow[];
  return { products, total_returned: products.length };
}

export async function getProduct(
  client: SupabaseClient,
  params: GetProductParams,
): Promise<GetProductResult> {
  const { data, error } = await client
    .from("financial_products")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    throw new Error(`get financial_product failed: ${error.message}`);
  }

  return { product: (data as ProductRow) ?? null };
}

export async function createProduct(
  client: SupabaseClient,
  params: CreateProductParams,
): Promise<CreateProductResult> {
  const insertData: Record<string, unknown> = {
    name: params.name,
    channel: params.channel,
    category: params.category,
  };

  if (params.code !== undefined) insertData.code = params.code;
  if (params.currency !== undefined) insertData.currency = params.currency;
  if (params.lock_period_days !== undefined) insertData.lock_period_days = params.lock_period_days;
  if (params.annual_return_rate !== undefined) insertData.annual_return_rate = params.annual_return_rate;

  const { data, error } = await client
    .from("financial_products")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`create financial_product failed: ${error.message}`);
  }

  return { product: data as ProductRow };
}

export async function updateProduct(
  client: SupabaseClient,
  params: UpdateProductParams,
): Promise<UpdateProductResult> {
  const updateData: Record<string, unknown> = {};

  if (params.name !== undefined) updateData.name = params.name;
  if (params.code !== undefined) updateData.code = params.code;
  if (params.channel !== undefined) updateData.channel = params.channel;
  if (params.category !== undefined) updateData.category = params.category;
  if (params.currency !== undefined) updateData.currency = params.currency;
  if (params.lock_period_days !== undefined) updateData.lock_period_days = params.lock_period_days;
  if (params.annual_return_rate !== undefined) updateData.annual_return_rate = params.annual_return_rate;

  if (Object.keys(updateData).length === 0) {
    throw new Error("update financial_product failed: no fields to update");
  }

  const { data, error } = await client
    .from("financial_products")
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`update financial_product failed: ${error.message}`);
  }

  return { product: data as ProductRow };
}

export async function deleteProduct(
  client: SupabaseClient,
  params: DeleteProductParams,
): Promise<DeleteProductResult> {
  const { error } = await client
    .from("financial_products")
    .delete()
    .eq("id", params.id);

  if (error) {
    throw new Error(`delete financial_product failed: ${error.message}`);
  }

  return { success: true };
}
