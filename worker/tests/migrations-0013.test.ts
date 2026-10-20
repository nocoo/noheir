import { readdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, test } from "vitest";
import { toIso } from "../src/financial-service";

const legacyIso = "2026-04-07T08:00:00.000Z";
const legacySeconds = 1775548800;
const legacyMsText = "1784956591451";
const legacyMs = 1784956591451;

function applyMigrations(db: Database.Database, through?: string) {
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const name of readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (through && name > through) break;
    db.exec(readFileSync(new URL(name, directory), "utf8"));
  }
}

describe("0013_normalize_legacy_timestamps", () => {
  test("converts parseable text timestamps and preserves integer rows, versions and audit", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applyMigrations(db, "0012_api_rate_limits.sql");

    db.exec(
      "INSERT INTO users(id,email,provider_account_id) VALUES('owner','owner@test','google-owner')",
    );
    db.prepare(
      `INSERT INTO financial_products (
        id, user_id, name, currency, version, is_archived, created_at, updated_at
      ) VALUES ('legacy-prod', 'owner', 'Legacy', 'CNY', 3, 0, ?, ?)`,
    ).run(legacyIso, legacyIso);
    db.prepare(
      `INSERT INTO financial_products (
        id, user_id, name, currency, version, is_archived, created_at, updated_at
      ) VALUES ('int-prod', 'owner', 'Integer', 'CNY', 5, 0, ?, ?)`,
    ).run(legacySeconds, legacySeconds + 10);

    db.prepare(
      `INSERT INTO capital_units (
        id, user_id, unit_code, amount_cents, currency, status, version, product_id, created_at, updated_at
      ) VALUES ('legacy-unit', 'owner', 'L1', 100, 'CNY', '已成立', 2, 'legacy-prod', ?, ?)`,
    ).run(legacyIso, legacyIso);
    db.prepare(
      `INSERT INTO capital_units (
        id, user_id, unit_code, amount_cents, currency, status, version, product_id, created_at, updated_at
      ) VALUES ('int-unit', 'owner', 'I1', 200, 'CNY', '已成立', 4, 'int-prod', ?, ?)`,
    ).run(legacySeconds, legacySeconds);

    db.prepare(
      `INSERT INTO contribution_logs (
        id, user_id, unit_id, product_id, operation_type, amount_cents, operation_date,
        source, version, created_at, updated_at, deleted_at
      ) VALUES (
        'legacy-log', 'owner', 'legacy-unit', 'legacy-prod', 'invest', 100, '2026-04-07',
        'mcp', 1, ?, ?, NULL
      )`,
    ).run(legacyIso, legacyIso);
    db.prepare(
      `INSERT INTO contribution_logs (
        id, user_id, unit_id, product_id, operation_type, amount_cents, operation_date,
        source, version, created_at, updated_at, deleted_at
      ) VALUES (
        'ms-log', 'owner', 'int-unit', 'int-prod', 'invest', 100, '2026-04-07',
        'auto', 1, ?, ?, NULL
      )`,
    ).run(legacyMsText, legacyMsText);
    db.prepare(
      `INSERT INTO contribution_logs (
        id, user_id, unit_id, product_id, operation_type, amount_cents, operation_date,
        source, version, created_at, updated_at, deleted_at
      ) VALUES (
        'sec-log', 'owner', 'int-unit', 'int-prod', 'invest', 100, '2026-04-07',
        'manual', 1, ?, ?, NULL
      )`,
    ).run(legacySeconds, legacySeconds);
    db.prepare(
      `INSERT INTO contribution_logs (
        id, user_id, unit_id, product_id, operation_type, amount_cents, operation_date,
        source, version, created_at, updated_at, deleted_at
      ) VALUES (
        'garbage-log', 'owner', 'int-unit', 'int-prod', 'invest', 100, '2026-04-07',
        'mcp', 1, 'not-a-date', 'not-a-date', 'also-bad'
      )`,
    ).run();

    const auditBefore = (db.prepare("SELECT count(*) n FROM api_audit").get() as { n: number }).n;
    const revisionBefore = (
      db.prepare("SELECT revision FROM owner_revisions WHERE owner_id='owner'").get() as
        | { revision: number }
        | undefined
    )?.revision;

    db.exec(
      readFileSync(
        new URL("../db/migrations/0013_normalize_legacy_timestamps.sql", import.meta.url),
        "utf8",
      ),
    );

    const product = db
      .prepare(
        "SELECT created_at, updated_at, version FROM financial_products WHERE id='legacy-prod'",
      )
      .get() as {
      created_at: number;
      updated_at: number;
      version: number;
    };
    expect(typeof product.created_at).toBe("number");
    expect(product.created_at).toBe(legacySeconds);
    expect(product.updated_at).toBe(legacySeconds);
    expect(product.version).toBe(3);
    expect(toIso(product.created_at)).toBe(legacyIso);

    const intProduct = db
      .prepare("SELECT created_at, updated_at, version FROM financial_products WHERE id='int-prod'")
      .get() as { created_at: number; updated_at: number; version: number };
    expect(intProduct.created_at).toBe(legacySeconds);
    expect(intProduct.updated_at).toBe(legacySeconds + 10);
    expect(intProduct.version).toBe(5);

    const unit = db
      .prepare("SELECT created_at, version FROM capital_units WHERE id='legacy-unit'")
      .get() as {
      created_at: number;
      version: number;
    };
    expect(unit.created_at).toBe(legacySeconds);
    expect(unit.version).toBe(2);

    const legacyLog = db
      .prepare(
        "SELECT created_at, updated_at, typeof(created_at) t FROM contribution_logs WHERE id='legacy-log'",
      )
      .get() as { created_at: number; updated_at: number; t: string };
    expect(legacyLog.t).toBe("integer");
    expect(legacyLog.created_at).toBe(legacySeconds);
    expect(legacyLog.updated_at).toBe(legacySeconds);

    const msLog = db
      .prepare("SELECT created_at FROM contribution_logs WHERE id='ms-log'")
      .get() as {
      created_at: number;
    };
    expect(msLog.created_at).toBe(legacyMs);

    const secLog = db
      .prepare("SELECT created_at FROM contribution_logs WHERE id='sec-log'")
      .get() as {
      created_at: number;
    };
    expect(secLog.created_at).toBe(legacySeconds);

    const garbage = db
      .prepare(
        "SELECT created_at, deleted_at, typeof(created_at) t FROM contribution_logs WHERE id='garbage-log'",
      )
      .get() as { created_at: string; deleted_at: string; t: string };
    expect(garbage.t).toBe("text");
    expect(garbage.created_at).toBe("not-a-date");
    expect(garbage.deleted_at).toBe("also-bad");

    expect((db.prepare("SELECT count(*) n FROM api_audit").get() as { n: number }).n).toBe(
      auditBefore,
    );
    expect(
      (
        db.prepare("SELECT revision FROM owner_revisions WHERE owner_id='owner'").get() as
          | { revision: number }
          | undefined
      )?.revision,
    ).toBe(revisionBefore);

    db.exec(
      readFileSync(
        new URL("../db/migrations/0013_normalize_legacy_timestamps.sql", import.meta.url),
        "utf8",
      ),
    );
    expect(
      db.prepare("SELECT created_at FROM financial_products WHERE id='legacy-prod'").get(),
    ).toEqual({ created_at: legacySeconds });

    db.close();
  });
});
