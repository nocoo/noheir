import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));

describe("Deployment boundaries", () => {
  test("production authenticates before assets and disables alternate hostnames", () => {
    expect(config.assets.run_worker_first).toBe(true);
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
    expect(config.vars.ENVIRONMENT).toBe("production");
    expect(config.vars).not.toHaveProperty("LOCAL_USER_EMAIL");
    expect(config.vars.CF_ACCESS_AUD).toBe(
      "19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee",
    );
  });
  test("local resources are owned by the launcher, not deployable environments", () => {
    expect(config).not.toHaveProperty("env");
  });
});
