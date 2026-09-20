import { readFileSync } from "node:fs";

export const BASE_URL = process.env.NOHEIR_TEST_ORIGIN ?? "";
if (BASE_URL !== "http://127.0.0.1:17004")
  throw new Error("HTTP tests require the isolated runner");
const markerPath = process.env.NOHEIR_TEST_MARKER_PATH;
const marker = process.env.NOHEIR_TEST_MARKER;
if (!markerPath || !marker || readFileSync(markerPath, "utf8") !== marker) {
  throw new Error("HTTP test marker missing or mismatched");
}
export const TOKENS: Record<string, string> = JSON.parse(process.env.NOHEIR_TEST_TOKENS ?? "{}");
export const TEST_USER_A = "e2e-user-alpha";
export const TEST_USER_B = "e2e-user-beta";
export const TEST_USER_C = "e2e-user-gamma";

export interface FetchOptions {
  method?: string;
  path: string;
  userId?: string;
  body?: unknown;
  token?: string;
  omitAuth?: boolean;
  redirect?: RequestRedirect;
  headers?: Record<string, string>;
}

export async function rawFetch(opts: FetchOptions): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: BASE_URL,
    ...opts.headers,
  };
  if (!opts.omitAuth)
    headers["Cf-Access-Jwt-Assertion"] =
      opts.token ?? TOKENS[opts.userId ?? TEST_USER_A] ?? TOKENS.unknown ?? "";
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
    redirect: opts.redirect ?? "manual",
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  return fetch(`${BASE_URL}${opts.path}`, init);
}

export async function api<T>(opts: FetchOptions): Promise<T> {
  const res = await rawFetch(opts);
  if (!res.ok)
    throw new Error(`${res.status} ${opts.method ?? "GET"} ${opts.path}: ${await res.text()}`);
  return (await res.json()) as T;
}
