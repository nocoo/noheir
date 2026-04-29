/**
 * MCP Entity Resolver
 *
 * Unified resolution logic for product and unit identifiers.
 * All tools accepting entity identifiers MUST use these resolvers.
 */

import type { Db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedProduct {
  id: string;
  name: string;
  code: string | null;
  channel: string | null;
  category: string | null;
  currency: string;
  lock_period_days: number;
  annual_return_rate: number | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

type ResolveResult =
  | { product: ResolvedProduct; error?: never }
  | { product?: never; error: string };

type InternalResolveResult =
  | { product: ResolvedProduct; error?: never }
  | { product: null; error?: never }
  | { product?: never; error: string };

export interface ResolveProductArgs {
  product_id?: string;
  product_name?: string;
  product_code?: string;
}

// ---------------------------------------------------------------------------
// Product Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a product from one or more identifiers.
 *
 * Rules:
 * - Exactly one identifier is recommended.
 * - If multiple identifiers provided, all must resolve to the same product.
 * - Short ID (≤8 chars) uses LIKE prefix match with LIMIT 2.
 * - Ambiguous matches return an error message (not thrown).
 *
 * Returns: { product } on success, or { error } on failure.
 */
export async function resolveProduct(
  db: Db,
  userId: string,
  args: ResolveProductArgs,
): Promise<ResolveResult> {
  const { product_id, product_name, product_code } = args;

  if (!product_id && !product_name && !product_code) {
    return { error: "Provide at least one of: product_id, product_name, product_code" };
  }

  // Resolve each provided identifier
  const resolved: { identifier: string; kind: string; product: ResolvedProduct }[] = [];

  if (product_id) {
    const result = await resolveByProductId(db, userId, product_id);
    if (result.error) return { error: result.error };
    if (!result.product) return { error: `Product not found: product_id=${product_id}` };
    resolved.push({ identifier: product_id, kind: "product_id", product: result.product });
  }

  if (product_name) {
    const result = await resolveByProductName(db, userId, product_name);
    if (result.error) return { error: result.error };
    if (!result.product) return { error: `Product not found: product_name=${product_name}` };
    resolved.push({ identifier: product_name, kind: "product_name", product: result.product });
  }

  if (product_code) {
    const result = await resolveByProductCode(db, userId, product_code);
    if (result.error) return { error: result.error };
    if (!result.product) return { error: `Product not found: product_code=${product_code}` };
    resolved.push({ identifier: product_code, kind: "product_code", product: result.product });
  }

  // If multiple identifiers, verify they all point to the same product
  if (resolved.length > 1) {
    const ids = resolved.map((r) => r.product.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size > 1) {
      const details = resolved
        .map((r) => `${r.kind}=${r.identifier} → ${r.product.name}`)
        .join(", ");
      return { error: `Conflicting identifiers: ${details}` };
    }
  }

  const first = resolved[0];
  if (!first) return { error: "No identifier provided" };
  return { product: first.product };
}

// ---------------------------------------------------------------------------
// Internal Resolvers
// ---------------------------------------------------------------------------

async function resolveByProductId(
  db: Db,
  userId: string,
  productId: string,
): Promise<InternalResolveResult> {
  const isShort = productId.length <= 8;

  if (isShort) {
    const result = await db.query<ResolvedProduct>(
      `SELECT id, name, code, channel, category, currency,
              lock_period_days, annual_return_rate, is_archived,
              created_at, updated_at
       FROM financial_products
       WHERE id LIKE ? AND user_id = ?
       LIMIT 2`,
      [`${productId}%`, userId],
    );

    if (result.results.length === 0) return { product: null };
    if (result.results.length > 1) {
      return { error: `Ambiguous short ID '${productId}' matches multiple products. Use full ID.` };
    }
    const first = result.results[0];
    return first ? { product: first } : { product: null };
  }

  // Full ID
  const product = await db.firstOrNull<ResolvedProduct>(
    `SELECT id, name, code, channel, category, currency,
            lock_period_days, annual_return_rate, is_archived,
            created_at, updated_at
     FROM financial_products
     WHERE id = ? AND user_id = ?`,
    [productId, userId],
  );

  return { product };
}

async function resolveByProductName(
  db: Db,
  userId: string,
  productName: string,
): Promise<InternalResolveResult> {
  const result = await db.query<ResolvedProduct>(
    `SELECT id, name, code, channel, category, currency,
            lock_period_days, annual_return_rate, is_archived,
            created_at, updated_at
     FROM financial_products
     WHERE name = ? AND user_id = ?`,
    [productName, userId],
  );

  if (result.results.length === 0) return { product: null };
  if (result.results.length > 1) {
    return { error: `Multiple products named '${productName}'. Use product_id.` };
  }
  const first = result.results[0];
  return first ? { product: first } : { product: null };
}

async function resolveByProductCode(
  db: Db,
  userId: string,
  productCode: string,
): Promise<InternalResolveResult> {
  const result = await db.query<ResolvedProduct>(
    `SELECT id, name, code, channel, category, currency,
            lock_period_days, annual_return_rate, is_archived,
            created_at, updated_at
     FROM financial_products
     WHERE code = ? AND user_id = ?`,
    [productCode, userId],
  );

  if (result.results.length === 0) return { product: null };
  if (result.results.length > 1) {
    return { error: `Multiple products with code '${productCode}'. Use product_id.` };
  }
  const first = result.results[0];
  return first ? { product: first } : { product: null };
}
