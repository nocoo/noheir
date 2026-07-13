"use server";

import { getAuthedClient } from "@/lib/api-helpers";

export async function getAvailableYears(): Promise<number[]> {
  try {
    const { userId, client } = await getAuthedClient();
    const metadata = await client.getMetadata(userId);
    return metadata.years.sort((a, b) => b - a);
  } catch {
    // Not authenticated or Worker unavailable — return empty so client uses fallback
    return [];
  }
}
