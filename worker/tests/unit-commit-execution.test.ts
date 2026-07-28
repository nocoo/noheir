/**
 * Executes the commit statements against a real SQLite database.
 *
 * The pure builder tests assert SQL shape; this one asserts behaviour under the
 * exact race the guard exists for. It lives outside the e2e suite because e2e
 * cannot pin two requests to the same millisecond — two HTTP calls naturally
 * land on different timestamps, so an e2e written for this scenario passes even
 * against the broken implementation (verified).
 */
import Database from "better-sqlite3";
import { beforeEach, describe, expect, test } from "vitest";
import { buildCommitStatements, type ExpectedUnitSnapshot } from "../lib/unit-commit";

let db: Database.Database;

const DDL = `
CREATE TABLE capital_units (
  id TEXT PRIMARY KEY, user_id TEXT, unit_code TEXT, amount_cents INTEGER,
  product_id TEXT, currency TEXT, status TEXT, strategy TEXT, tactics TEXT,
  start_date TEXT, end_date TEXT, note TEXT, commit_token TEXT, updated_at INTEGER
);
CREATE TABLE contribution_logs (
  id TEXT PRIMARY KEY, user_id TEXT, unit_id TEXT, product_id TEXT,
  product_name TEXT, operation_type TEXT, amount_cents INTEGER, pnl_cents INTEGER,
  operation_date TEXT, source TEXT, note TEXT, created_at INTEGER, updated_at INTEGER
);`;

const expected: ExpectedUnitSnapshot = {
  unitCode: "CU01-001",
  amountCents: 100000,
  productId: null,
  currency: "CNY",
  status: "已成立",
  strategy: "长期理财",
  tactics: "债券基金",
  startDate: null,
  endDate: null,
  note: null,
};

/** Both requests target the same amount and share `now` — the exact race. */
function commit(token: string, note: string, now = 1_700_000_000_000) {
  let n = 0;
  const statements = buildCommitStatements({
    userId: "usr",
    unitId: "unit-a",
    expected,
    metadata: { amountCents: 200000 },
    operations: [],
    operationDate: "2026-07-28",
    today: "2026-07-28",
    commitNote: note,
    now,
    commitToken: token,
    newId: () => `${token}-log-${++n}`,
  });
  return statements.map((s) => db.prepare(s.sql).run(...(s.params as unknown[])));
}

/** A swap commit whose CAS may or may not hold. */
function swapCommit(token: string, now = 1_700_000_000_000) {
  let n = 0;
  const statements = buildCommitStatements({
    userId: "usr",
    unitId: "unit-a",
    expected,
    operations: [{ kind: "swap_unit_code", targetUnitId: "unit-b" }],
    swapTarget: { id: "unit-b", unitCode: "CU01-002", productId: null, productName: null },
    operationDate: "2026-07-28",
    today: "2026-07-28",
    now,
    commitToken: token,
    newId: () => `${token}-log-${++n}`,
  });
  return statements.map((s) => db.prepare(s.sql).run(...(s.params as unknown[])));
}

describe("commit execution against SQLite", () => {
  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(DDL);
    db.prepare(
      `INSERT INTO capital_units VALUES ('unit-a','usr','CU01-001',100000,NULL,'CNY','已成立','长期理财','债券基金',NULL,NULL,NULL,NULL,1)`,
    ).run();
  });

  test("the winning commit applies and logs once", () => {
    const [update, log] = commit("token-A", "winner");
    expect(update?.changes).toBe(1);
    expect(log?.changes).toBe(1);
  });

  test("a losing commit with an identical target writes no log", () => {
    commit("token-A", "winner");

    // Same intended amount, same millisecond — the row now looks exactly like
    // what this commit wanted, so a post-state guard would match it. Only the
    // token distinguishes "I wrote this" from "this resembles my target".
    const [update, log] = commit("token-B", "loser");

    expect(update?.changes).toBe(0);
    expect(log?.changes).toBe(0);

    const rows = db.prepare("SELECT note FROM contribution_logs").all() as { note: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.note).toContain("winner");
  });

  test("a losing swap leaves the partner untouched", () => {
    db.prepare(
      `INSERT INTO capital_units VALUES ('unit-b','usr','CU01-002',200000,NULL,'CNY','已成立','长期理财','债券基金',NULL,NULL,NULL,NULL,1)`,
    ).run();

    // Another request already renamed A to the swap target's code. unit_code has
    // no unique index, so this is a legal state — and it makes "A carries B's
    // code" true without this commit having caused it.
    db.prepare("UPDATE capital_units SET unit_code='CU01-002' WHERE id='unit-a'").run();

    const changes = swapCommit("token-late").map((r) => r.changes);

    // [0] loses the CAS, so nothing at all may be written.
    expect(changes[0]).toBe(0);
    expect(changes.slice(1).every((c) => c === 0)).toBe(true);

    const partner = db.prepare("SELECT unit_code FROM capital_units WHERE id='unit-b'").get() as {
      unit_code: string;
    };
    expect(partner.unit_code).toBe("CU01-002");
    expect(db.prepare("SELECT COUNT(*) n FROM contribution_logs").get()).toEqual({ n: 0 });
  });

  test("a winning swap exchanges both codes and logs both units", () => {
    db.prepare(
      `INSERT INTO capital_units VALUES ('unit-b','usr','CU01-002',200000,NULL,'CNY','已成立','长期理财','债券基金',NULL,NULL,NULL,NULL,1)`,
    ).run();

    const changes = swapCommit("token-ok").map((r) => r.changes);
    expect(changes.every((c) => c === 1)).toBe(true);

    const rows = db.prepare("SELECT id, unit_code FROM capital_units ORDER BY id").all() as {
      id: string;
      unit_code: string;
    }[];
    expect(rows).toEqual([
      { id: "unit-a", unit_code: "CU01-002" },
      { id: "unit-b", unit_code: "CU01-001" },
    ]);
    expect(db.prepare("SELECT COUNT(*) n FROM contribution_logs").get()).toEqual({ n: 2 });
  });

  test("the winner's token is what lands on the row", () => {
    commit("token-A", "winner");
    commit("token-B", "loser");

    const row = db.prepare("SELECT commit_token FROM capital_units").get() as {
      commit_token: string;
    };
    expect(row.commit_token).toBe("token-A");
  });
});
