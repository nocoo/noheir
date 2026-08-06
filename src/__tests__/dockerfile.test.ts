import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const dockerfile = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8");

describe("Docker build runtimes", () => {
  test("keeps the Bun canary workaround scoped to the Next.js build", () => {
    expect(dockerfile).toContain("ARG BUN_STABLE_IMAGE=oven/bun:1.3.14@sha256:");
    expect(dockerfile).toContain("ARG BUN_BUILD_IMAGE=oven/bun:canary@sha256:");
    expect(dockerfile.match(/FROM \$\{BUN_STABLE_IMAGE\}/g)).toHaveLength(3);
    expect(dockerfile).toMatch(/FROM \$\{BUN_BUILD_IMAGE\} AS build-runtime/);

    const stableInstall = dockerfile.indexOf("RUN bun install --frozen-lockfile");
    const canaryCopy = dockerfile.indexOf(
      "COPY --from=build-runtime /usr/local/bin/bun /usr/local/bin/bun",
    );
    const appBuild = dockerfile.indexOf("RUN bun run build");

    expect(stableInstall).toBeGreaterThan(-1);
    expect(canaryCopy).toBeGreaterThan(stableInstall);
    expect(appBuild).toBeGreaterThan(canaryCopy);
  });
});
