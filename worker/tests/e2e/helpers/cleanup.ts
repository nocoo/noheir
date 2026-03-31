/**
 * Clean up all test data for a given user via the Worker REST API.
 *
 * Strategy:
 * 1. POST /api/restore with empty arrays → deletes all transactions + transfers
 * 2. GET /api/units → DELETE each unit
 * 3. GET /api/products → DELETE each product
 * 4. DELETE /api/settings → remove settings row
 *
 * This ensures FK order is respected (units reference products).
 */
import { api } from "./client";

export async function cleanupUser(userId: string): Promise<void> {
  // 1. Wipe transactions + transfers via restore
  await api({
    method: "POST",
    path: "/api/restore",
    userId,
    body: { transactions: [], transfers: [] },
  });

  // 2. Delete all units (must go before products due to FK)
  const { units } = await api<{ units: Array<{ id: string }> }>({
    method: "GET",
    path: "/api/units",
    userId,
  });
  for (const u of units) {
    await api({ method: "DELETE", path: `/api/units/${u.id}`, userId });
  }

  // 3. Delete all products
  const { products } = await api<{ products: Array<{ id: string }> }>({
    method: "GET",
    path: "/api/products",
    userId,
  });
  for (const p of products) {
    await api({ method: "DELETE", path: `/api/products/${p.id}`, userId });
  }

  // 4. Delete settings
  try {
    await api({ method: "DELETE", path: "/api/settings", userId });
  } catch {
    // 404 is fine — no settings to delete
  }
}
