#!/usr/bin/env bun
/**
 * Migration script: Supabase → D1
 * Migrates financial_products and capital_units from old Supabase to new D1.
 *
 * Usage:
 *   bun run scripts/migrate-supabase-to-d1.ts
 *
 * Prerequisites:
 *   - Old data exported to /tmp/old_products.json and /tmp/old_units.json
 *   - WORKER_URL and WORKER_TOKEN in .env.local
 */

import { readFileSync } from "fs";

// ── Configuration ──
const WORKER_URL = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";
const WORKER_TOKEN = process.env.WORKER_TOKEN || "b5edfb5b65dd841904149c2b6e59e7d5977ad8ade330c2768893f81e32bb7605";
const NEW_USER_ID = "103048496470438908451"; // Google sub from D1 users table

// Old Supabase user_id (for verification)
const OLD_USER_ID = "b5a58998-bee3-43fd-9fe1-ab5ed97a8076";

// ── Types ──
interface OldProduct {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  channel: string | null;
  category: string | null;
  currency: string;
  lock_period_days: number;
  annual_return_rate: number | null;
  created_at: string;
}

interface OldUnit {
  id: string;
  user_id: string;
  unit_code: string;
  amount: number; // Decimal in Supabase (元)
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

// ── API Helper ──
async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${WORKER_TOKEN}`,
      "X-User-Id": NEW_USER_ID,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Main ──
async function main() {
  console.log("🚀 Starting migration: Supabase → D1\n");

  // Load old data
  const oldProducts: OldProduct[] = JSON.parse(readFileSync("/tmp/old_products.json", "utf-8"));
  const oldUnits: OldUnit[] = JSON.parse(readFileSync("/tmp/old_units.json", "utf-8"));

  // Filter by old user_id
  const userProducts = oldProducts.filter(p => p.user_id === OLD_USER_ID);
  const userUnits = oldUnits.filter(u => u.user_id === OLD_USER_ID);

  console.log(`📦 Found ${userProducts.length} products, ${userUnits.length} units for user\n`);

  // Check existing data in D1
  const existingProducts = await api<{ products: unknown[]; total_returned: number }>("GET", "/api/products");
  const existingUnits = await api<{ units: unknown[]; total_returned: number }>("GET", "/api/units");

  console.log(`📊 D1 current state: ${existingProducts.total_returned} products, ${existingUnits.total_returned} units`);

  if (existingProducts.total_returned > 0 || existingUnits.total_returned > 0) {
    console.log("\n⚠️  D1 already has data! Skipping migration to avoid duplicates.");
    console.log("   To force migration, delete existing data first.");
    return;
  }

  // ── Migrate Products ──
  console.log("\n📦 Migrating products...");
  const productIdMap = new Map<string, string>(); // old_id → new_id

  for (const p of userProducts) {
    const newProduct = await api<{ product: { id: string } }>("POST", "/api/products", {
      name: p.name,
      code: p.code,
      channel: p.channel,
      category: p.category,
      currency: p.currency,
      lockPeriodDays: p.lock_period_days,
      annualReturnRate: p.annual_return_rate,
    });

    productIdMap.set(p.id, newProduct.product.id);
    console.log(`  ✅ ${p.name}`);
  }

  console.log(`\n📦 Migrated ${productIdMap.size} products`);

  // ── Migrate Units ──
  console.log("\n💰 Migrating capital units...");
  let unitCount = 0;

  for (const u of userUnits) {
    // Convert amount from 元 to 分 (cents)
    const amountCents = Math.round(u.amount * 100);

    // Map old product_id to new product_id
    const newProductId = u.product_id ? productIdMap.get(u.product_id) : null;

    await api<{ unit: { id: string } }>("POST", "/api/units", {
      unitCode: u.unit_code,
      amountCents,
      currency: u.currency,
      status: u.status,
      strategy: u.strategy,
      tactics: u.tactics,
      productId: newProductId,
      startDate: u.start_date,
      endDate: u.end_date,
      note: u.note,
    });

    unitCount++;
    if (unitCount % 20 === 0) {
      console.log(`  ... ${unitCount}/${userUnits.length}`);
    }
  }

  console.log(`\n💰 Migrated ${unitCount} capital units`);

  // ── Verify ──
  console.log("\n🔍 Verifying migration...");
  const finalProducts = await api<{ total_returned: number }>("GET", "/api/products");
  const finalUnits = await api<{ total_returned: number }>("GET", "/api/units");

  console.log(`   Products: ${finalProducts.total_returned}`);
  console.log(`   Units: ${finalUnits.total_returned}`);

  console.log("\n✅ Migration complete!");
}

main().catch(console.error);
