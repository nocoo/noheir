import { describe, expect, it, vi } from "vitest";
import { createD1Db, type Db } from "../../lib/db";

interface FakeStmt {
  sql: string;
  bound: unknown[];
  bind: (...params: unknown[]) => FakeStmt;
  all: () => Promise<{ results: unknown[]; meta: { changes: number } }>;
  run: () => Promise<{ meta: { changes: number } }>;
}

function createFakeD1(
  options: {
    allResults?: unknown[];
    allChanges?: number;
    runChanges?: number;
    batchResults?: Array<{ results?: unknown[]; meta?: { changes: number } }>;
  } = {},
) {
  const prepared: FakeStmt[] = [];
  const d1 = {
    prepare(sql: string) {
      const stmt: FakeStmt = {
        sql,
        bound: [],
        bind(...params: unknown[]) {
          stmt.bound = params;
          return stmt;
        },
        async all() {
          return {
            results: options.allResults ?? [],
            meta: { changes: options.allChanges ?? 0 },
          };
        },
        async run() {
          return { meta: { changes: options.runChanges ?? 1 } };
        },
      };
      prepared.push(stmt);
      return stmt;
    },
    async batch(statements: FakeStmt[]) {
      if (options.batchResults) return options.batchResults;
      return statements.map(() => ({ results: [], meta: { changes: 0 } }));
    },
  };
  return { d1: d1 as unknown as D1Database, prepared };
}

describe("createD1Db", () => {
  it("is request-scoped and does not share state across adapters", () => {
    const a = createD1Db(createFakeD1().d1);
    const b = createD1Db(createFakeD1().d1);
    expect(a).not.toBe(b);
  });

  it("query binds params, maps results, and defaults missing rows/changes", async () => {
    const { d1, prepared } = createFakeD1({ allResults: [{ id: "1" }], allChanges: 2 });
    const db = createD1Db(d1);
    const withParams = await db.query("SELECT ?", [7]);
    expect(prepared[0]?.sql).toBe("SELECT ?");
    expect(prepared[0]?.bound).toEqual([7]);
    expect(withParams.results).toEqual([{ id: "1" }]);
    expect(withParams.meta.changes).toBe(2);
    expect(withParams.meta.duration).toBeGreaterThanOrEqual(0);

    const { d1: emptyD1, prepared: emptyPrepared } = createFakeD1();
    const empty = await createD1Db(emptyD1).query("SELECT 1");
    expect(emptyPrepared[0]?.bound).toEqual([]);
    expect(empty.results).toEqual([]);
    expect(empty.meta.changes).toBe(0);
  });

  it("firstOrNull returns the first row or null", async () => {
    const found = await createD1Db(
      createFakeD1({ allResults: [{ n: 1 }, { n: 2 }] }).d1,
    ).firstOrNull("SELECT n");
    expect(found).toEqual({ n: 1 });
    const missing = await createD1Db(createFakeD1({ allResults: [] }).d1).firstOrNull("SELECT n");
    expect(missing).toBeNull();
  });

  it("execute uses run() and reports changes", async () => {
    const { d1, prepared } = createFakeD1({ runChanges: 4 });
    const meta = await createD1Db(d1).execute("UPDATE t SET x = ?", ["v"]);
    expect(prepared[0]?.bound).toEqual(["v"]);
    expect(meta.changes).toBe(4);
    expect(meta.duration).toBeGreaterThanOrEqual(0);
  });

  it("batch prepares each statement against the same D1 binding", async () => {
    const { d1, prepared } = createFakeD1({
      batchResults: [
        { results: [{ a: 1 }], meta: { changes: 1 } },
        { results: [], meta: { changes: 3 } },
      ],
    });
    const db: Db = createD1Db(d1);
    const rows = await db.batch([
      { sql: "DELETE FROM t WHERE id = ?", params: ["x"] },
      { sql: "SELECT 1" },
    ]);
    expect(prepared).toHaveLength(2);
    expect(prepared[0]?.bound).toEqual(["x"]);
    expect(prepared[1]?.bound).toEqual([]);
    expect(rows[0]?.results).toEqual([{ a: 1 }]);
    expect(rows[1]?.meta.changes).toBe(3);
    expect(rows[0]?.meta.duration).toBe(rows[1]?.meta.duration);
  });

  it("batch defaults missing results and changes", async () => {
    const { d1 } = createFakeD1({
      batchResults: [{}],
    });
    const rows = await createD1Db(d1).batch([{ sql: "SELECT 1" }]);
    expect(rows[0]?.results).toEqual([]);
    expect(rows[0]?.meta.changes).toBe(0);
    expect(rows[0]?.meta.duration).toBeGreaterThanOrEqual(0);
  });

  it("execute without params does not bind", async () => {
    const { d1, prepared } = createFakeD1({ runChanges: 0 });
    const meta = await createD1Db(d1).execute("SELECT 1");
    expect(prepared[0]?.bound).toEqual([]);
    expect(meta.changes).toBe(0);
  });
});

describe("createD1Db clock", () => {
  it("records duration from Date.now", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(1000).mockReturnValueOnce(1015);
    const meta = await createD1Db(createFakeD1().d1).execute("SELECT 1");
    expect(meta.duration).toBe(15);
    now.mockRestore();
  });
});
