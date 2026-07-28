/**
 * Guards the capital enums that are duplicated across the codebase.
 *
 * STRATEGIES / TACTICS / STATUSES are declared once in worker/db/enums.ts (the
 * Zod source of truth), once as a union in src/domain/types.ts, and again as a
 * literal array inside each client component that renders a dropdown — five
 * files, fifteen copies.
 *
 * When 混债基金 / 现金管理 were added to satisfy pre-existing production rows
 * (units B25, B26, E01), every copy had to change together. Miss one and the
 * dropdown silently offers a value the server rejects, or hides a value the
 * data already uses — the failure shows up as a Zod error at save time, far
 * from the edit that caused it.
 *
 * These tests read the actual sources so a new value cannot be added to some
 * copies and forgotten in the rest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PRODUCT_CATEGORY_TOKEN_MAP, STRATEGY_TOKEN_MAP, TACTICS_TOKEN_MAP } from "@/lib/palette";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Pull a `const NAME = [ "a", "b" ];` literal out of a source file. */
function parseArrayLiteral(source: string, name: string): string[] {
  const start = source.indexOf(`const ${name} = [`);
  if (start === -1) throw new Error(`${name} not found`);
  // Stop at the first closing bracket: worker enums end with `] as const;`
  // while client copies end with `];`, and the next declaration follows
  // immediately in both.
  const end = source.indexOf("]", start + `const ${name} = [`.length);
  return [...source.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
}

/** Pull a `type X = | "a" | "b";` union out of a source file. */
function parseUnion(source: string, name: string): string[] {
  const start = source.indexOf(`export type ${name} =`);
  if (start === -1) throw new Error(`${name} not found`);
  const end = source.indexOf(";", start);
  return [...source.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
}

const workerEnums = read("worker/db/enums.ts");
const domainTypes = read("src/domain/types.ts");

/** Every client file that re-declares the dropdown options. */
const CLIENT_FILES = [
  "src/components/capital/unit-editor.tsx",
  "src/components/capital/unit-commit-dialog.tsx",
  "src/app/warehouse/warehouse-client.tsx",
  "src/app/funds/funds-client.tsx",
  "src/app/capital-dashboard/capital-dashboard-client.tsx",
] as const;

const CASES = [
  { arrayName: "STRATEGIES", unionName: "InvestmentStrategy", tokenMap: STRATEGY_TOKEN_MAP },
  { arrayName: "TACTICS", unionName: "InvestmentTactics", tokenMap: TACTICS_TOKEN_MAP },
  { arrayName: "UNIT_STATUSES", unionName: "UnitStatus", clientName: "STATUSES" },
] as const;

describe("warehouse card category flag", () => {
  // The flag is a bare string comparison against the product category. A typo,
  // or renaming the category, would silently stop flagging anything — nothing
  // would error, the corner would just never appear.
  test("the flagged category is a real product category", () => {
    const source = read("src/app/warehouse/warehouse-client.tsx");
    const match = source.match(/const FLAGGED_CATEGORY = "([^"]+)"/);
    expect(match).not.toBeNull();
    expect(Object.keys(PRODUCT_CATEGORY_TOKEN_MAP)).toContain(match?.[1]);
  });
});

describe("capital enum copies stay in sync", () => {
  for (const c of CASES) {
    const expected = parseArrayLiteral(workerEnums, c.arrayName);

    test(`${c.arrayName}: domain union matches the worker enum`, () => {
      expect(parseUnion(domainTypes, c.unionName)).toEqual(expected);
    });

    for (const file of CLIENT_FILES) {
      const clientName = "clientName" in c ? c.clientName : c.arrayName;
      test(`${c.arrayName}: ${file} matches the worker enum`, () => {
        expect(parseArrayLiteral(read(file), clientName)).toEqual(expected);
      });
    }

    if ("tokenMap" in c) {
      test(`${c.arrayName}: every value has a colour token`, () => {
        // Without a mapping the badge silently falls back to a hashed colour,
        // which breaks the "same label, same colour everywhere" rule.
        expect(Object.keys(c.tokenMap).sort()).toEqual([...expected].sort());
      });
    }
  }
});
