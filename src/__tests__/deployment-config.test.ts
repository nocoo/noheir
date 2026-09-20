import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));

describe("Deployment boundaries", () => {
  test("production authenticates before assets and disables alternate hostnames", () => {
    expect(config.assets.run_worker_first).toBe(true);
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
    expect(config.vars.ENVIRONMENT).toBe("production");
    expect(config.vars.LOCAL_USER_EMAIL).toBe("");
    expect(config.vars.CF_ACCESS_AUD).toBe(
      "19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee",
    );
  });
  test.each(["local", "test"])("%s has no production route or database binding", (name) => {
    const environment = config.env[name];
    expect(environment.routes).toEqual([]);
    expect(environment.vars.ENVIRONMENT).toBe(name);
    expect(environment.d1_databases[0].database_id).toBe(`${name}-noheir`);
    expect(environment.d1_databases[0].database_id).not.toBe(config.d1_databases[0].database_id);
    expect(environment.d1_databases[0].remote).not.toBe(true);
  });
});
