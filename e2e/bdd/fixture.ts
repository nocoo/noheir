import { existsSync, readFileSync } from "node:fs";
import { expect } from "@playwright/test";

export const ORIGIN = "http://127.0.0.1:27004";
const TOKEN_PATH = new URL("../../.wrangler/browser-token.json", import.meta.url);

export async function readBrowserToken(): Promise<string> {
  await expect.poll(() => existsSync(TOKEN_PATH), { timeout: 15_000 }).toBe(true);
  return (JSON.parse(readFileSync(TOKEN_PATH, "utf8")) as { token: string }).token;
}
