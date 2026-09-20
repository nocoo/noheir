import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (process.env.CLOUDFLARE_ENV || process.env.NOHEIR_TEST_STATE) {
  throw new Error("Deployment requires production configuration");
}
if (
  config.name !== "noheir-web" ||
  config.vars.ENVIRONMENT !== "production" ||
  config.vars.LOCAL_USER_EMAIL ||
  config.vars.CF_ACCESS_TEAM_DOMAIN !== "nocoo" ||
  config.vars.CF_ACCESS_AUD !==
    "19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee" ||
  config.d1_databases[0]?.database_id !== "586c101d-df19-4e1f-a946-42151c1e199d" ||
  config.workers_dev !== false ||
  config.preview_urls !== false ||
  config.assets.run_worker_first !== true ||
  config.routes[0]?.pattern !== "noheir.hexly.ai"
) {
  throw new Error("Worker, Access, assets and D1 must match the approved production configuration");
}
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) {
  throw new Error("Commit the complete deployment before publishing");
}
for (const args of [
  ["run", "build"],
  ["x", "wrangler", "deploy", "--tag", `v${version}`, "--message", sha],
]) {
  const result = spawnSync("bun", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
