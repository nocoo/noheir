import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const dockerfile = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8");
const stableImageArg =
  "ARG BUN_STABLE_IMAGE=oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4";
const buildImageArg =
  "ARG BUN_BUILD_IMAGE=oven/bun:canary@sha256:dd2479e914bd3ec71f26e6498d84efabd2d13581387c47d76a39814d89f03eb1";
const canaryCopy = "COPY --from=build-runtime /usr/local/bin/bun /usr/local/bin/bun";

function getStage(name: string): string {
  const stage = dockerfile
    .split(/(?=^FROM )/m)
    .find((section) => new RegExp(`^FROM [^\\n]+ AS ${name}$`, "m").test(section));

  if (!stage) throw new Error(`Missing Docker stage: ${name}`);
  return stage;
}

describe("Docker build runtimes", () => {
  test("pins complete Bun image references", () => {
    expect(dockerfile.match(/^ARG BUN_STABLE_IMAGE=.*$/gm)).toEqual([stableImageArg]);
    expect(dockerfile.match(/^ARG BUN_BUILD_IMAGE=.*$/gm)).toEqual([buildImageArg]);
    expect(dockerfile.match(/FROM \$\{BUN_STABLE_IMAGE\}/g)).toHaveLength(3);
    expect(dockerfile.match(/FROM \$\{BUN_BUILD_IMAGE\}/g)).toHaveLength(1);
    expect(getStage("deps")).toMatch(/^FROM \$\{BUN_STABLE_IMAGE\} AS deps$/m);
    expect(getStage("build-runtime")).toMatch(/^FROM \$\{BUN_BUILD_IMAGE\} AS build-runtime$/m);
    expect(getStage("builder")).toMatch(/^FROM \$\{BUN_STABLE_IMAGE\} AS builder$/m);
    expect(getStage("runner")).toMatch(/^FROM \$\{BUN_STABLE_IMAGE\} AS runner$/m);
  });

  test("keeps the Bun canary workaround scoped to the Next.js build", () => {
    const builderStage = getStage("builder");
    const runnerStage = getStage("runner");

    expect(dockerfile.match(new RegExp(canaryCopy, "g"))).toEqual([canaryCopy]);
    expect(builderStage).toContain(canaryCopy);
    expect(runnerStage).not.toContain("build-runtime");
    expect(runnerStage).not.toContain("BUN_BUILD_IMAGE");

    const installs = dockerfile.match(/RUN bun install --frozen-lockfile/g);
    const canaryCopyIndex = builderStage.indexOf(canaryCopy);
    const appBuildIndex = builderStage.indexOf("RUN bun run build");

    expect(installs).toHaveLength(1);
    expect(canaryCopyIndex).toBeGreaterThan(-1);
    expect(appBuildIndex).toBeGreaterThan(canaryCopyIndex);
    expect(builderStage.slice(canaryCopyIndex)).not.toContain("bun install");
  });
});
