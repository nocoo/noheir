/**
 * Clean up all test data for a given user via the Worker REST API.
 *
 * Strategy:
 * 1. POST /api/data/import with empty arrays → deletes all transactions + transfers
 * 2. GET /api/units → DELETE each unit
 * 3. GET /api/products → DELETE each product
 * 4. DELETE /api/settings → remove settings row
 *
 * This ensures FK order is respected (units reference products).
 */
import { api } from "./client";

/**
 * Ensure a test user exists in the users table.
 * This is required before creating products/units due to FK constraints.
 */
export async function ensureTestUser(userId: string): Promise<void> {
  await api({
    method: "PUT",
    path: "/api/users/me",
    userId,
    body: {
      email: `${userId}@test.local`,
      name: userId,
      providerAccountId: userId,
    },
  });
}

export async function cleanupUser(userId: string): Promise<void> {
  // 0. Ensure user exists first (for FK constraints)
  await ensureTestUser(userId);

  // 1. Wipe transactions + transfers via import
  await api({
    method: "POST",
    path: "/api/data/import",
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

  // 3. Delete all products (including archived)
  const { products } = await api<{ products: Array<{ id: string }> }>({
    method: "GET",
    path: "/api/products?includeArchived=true",
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
