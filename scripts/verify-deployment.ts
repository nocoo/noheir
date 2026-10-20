import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const origin = "https://noheir.hexly.ai";
const request = (path: string, method = "GET") =>
  fetch(`${origin}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
const response = await request("/api/live");
if (response.status !== 200) throw new Error(`Health status: ${response.status}`);
const health = (await response.json()) as {
  status: string;
  version: string;
  build_sha: string;
  component: string;
  database?: { connected: boolean };
};
if (
  health.status !== "ok" ||
  health.version !== version ||
  health.build_sha !== sha ||
  health.component !== "noheir" ||
  health.database?.connected !== true ||
  !response.headers.get("cache-control")?.includes("no-store")
) {
  throw new Error("Production revision, version, health or cache policy does not match");
}
for (const path of [
  "/",
  "/terms",
  "/privacy",
  "/api/auth/me",
  "/api/reports/metadata",
  "/api/api-keys",
  "/api/settings",
  "/analyses",
]) {
  const result = await request(path);
  const location = result.headers.get("location");
  if (
    result.status !== 302 ||
    !location ||
    new URL(location).hostname !== "nocoo.cloudflareaccess.com"
  ) {
    throw new Error(`Access protection failed: ${path} (${result.status})`);
  }
}
const metadata = await request("/api/v1/openapi.json");
if (metadata.status !== 200 || ((await metadata.json()) as { openapi: string }).openapi !== "3.1.0")
  throw new Error("REST discovery failed");
for (const path of ["/api/v1/me", "/api/v1/transactions"]) {
  const result = await request(path);
  if (result.status !== 401 || !result.headers.get("www-authenticate")?.includes("Bearer"))
    throw new Error(`REST must require its own Bearer key: ${path} (${result.status})`);
}
console.log(`Verified Noheir ${version} at ${sha}: D1, Access and scoped REST boundaries.`);
