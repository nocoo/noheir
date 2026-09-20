import { workerDbClient } from "@/lib/worker-db-client";

export async function getAvailableYears(): Promise<number[]> {
  try {
    const metadata = await workerDbClient.getMetadata();
    return metadata.years.sort((a, b) => b - a);
  } catch {
    return [];
  }
}
