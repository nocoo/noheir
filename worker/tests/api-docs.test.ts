import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { listMachineApiRoutes } from "../src/scoped-api";

const docsPath = fileURLToPath(new URL("../../docs/api.md", import.meta.url));
const ROUTE_MARKER = /<!--\s*route:\s*([A-Z]+)\s+(\/api\/v1\/[^\s]+)\s*-->/g;

function documentedRoutes(markdown: string): string[] {
  const routes: string[] = [];
  for (const match of markdown.matchAll(ROUTE_MARKER)) {
    routes.push(`${match[1]} ${match[2]}`);
  }
  return [...new Set(routes)].sort();
}

describe("docs/api.md", () => {
  test("documents every registered /api/v1 route", () => {
    const markdown = readFileSync(docsPath, "utf8");
    const expected = listMachineApiRoutes();
    const documented = documentedRoutes(markdown);
    expect(documented).toEqual(expected);
  });
});
