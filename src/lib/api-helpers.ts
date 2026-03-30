/**
 * Server-side helpers for accessing the Worker DB from Next.js.
 *
 * Used by Server Components and Server Actions to get an authenticated
 * WorkerDbClient instance scoped to the current user.
 *
 * IMPORTANT: This module must NEVER be imported in client-side code.
 */
import { auth } from "@/auth";
import { WorkerDbClient, type TargetDb } from "./worker-db-client";

function getWorkerUrl(): string {
  const url = process.env.WORKER_URL;
  if (!url) throw new Error("WORKER_URL env var is not set");
  return url;
}

function getWorkerSecret(): string {
  const secret = process.env.WORKER_TOKEN;
  if (!secret) throw new Error("WORKER_TOKEN env var is not set");
  return secret;
}

function resolveTargetDb(): TargetDb {
  return (process.env.WORKER_TARGET_DB === "test") ? "test" : "production";
}

/**
 * Create a WorkerDbClient configured from environment variables.
 * Does NOT include user context — pass userId to each method.
 */
export function createWorkerClient(targetDb?: TargetDb): WorkerDbClient {
  return new WorkerDbClient(
    getWorkerUrl(),
    getWorkerSecret(),
    targetDb ?? resolveTargetDb(),
  );
}

/**
 * Get the current user's ID from the NextAuth session.
 * Throws if not authenticated.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return session.user.id;
}

/**
 * Convenience: get both the authenticated userId and a WorkerDbClient.
 * Typical usage in Server Components and Server Actions:
 *
 * ```ts
 * const { userId, client } = await getAuthedClient();
 * const data = await client.searchTransactions(userId, { year: 2026 });
 * ```
 */
export async function getAuthedClient(targetDb?: TargetDb) {
  const userId = await requireUserId();
  const client = createWorkerClient(targetDb);
  return { userId, client };
}
