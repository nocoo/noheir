import { describe, expect, test } from "vitest";
import {
  parseCsvImport,
  parseImportFile,
  parseJsonImport,
} from "@/domain/import/parse-import-file";

// ── JSON parsing ──

describe("parseJsonImport", () => {
  test("parses valid structure with both arrays", () => {
    const input = JSON.stringify({
      transactions: [{ date: "2026-01-01", type: "expense", amount_cents: 1000 }],
      transfers: [{ date: "2026-01-01", inflow_amount_cents: 500 }],
    });
    const result = parseJsonImport(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transfers).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  test("handles backup format with extra keys", () => {
    const input = JSON.stringify({
      transactions: [{ id: "1" }],
      transfers: [],
      products: [{ id: "p1" }],
      units: [],
      settings: {},
      exported_at: "2026-01-01",
    });
    const result = parseJsonImport(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transfers).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("returns error for invalid JSON", () => {
    const result = parseJsonImport("not json{");
    expect(result.transactions).toHaveLength(0);
    expect(result.transfers).toHaveLength(0);
    expect(result.errors).toContain("Invalid JSON format");
  });

  test("returns error for JSON array instead of object", () => {
    const result = parseJsonImport("[1, 2, 3]");
    expect(result.errors[0]).toContain("JSON must be an object");
  });

  test("returns error when no transactions or transfers keys", () => {
    const result = parseJsonImport('{"foo": "bar"}');
    expect(result.errors[0]).toContain("No transactions or transfers found");
  });

  test("handles empty arrays", () => {
    const result = parseJsonImport('{"transactions": [], "transfers": []}');
    expect(result.transactions).toHaveLength(0);
    expect(result.transfers).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("filters out non-object transaction rows", () => {
    const input = JSON.stringify({
      transactions: [{ id: "1" }, "invalid", null, { id: "2" }],
      transfers: [],
    });
    const result = parseJsonImport(input);
    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
  });

  test("handles JSON with only transactions key", () => {
    const input = JSON.stringify({
      transactions: [{ date: "2026-01-01" }],
    });
    const result = parseJsonImport(input);
    expect(result.transactions).toHaveLength(1);
    expect(result.transfers).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ── CSV parsing ──

describe("parseCsvImport", () => {
  test("parses transaction CSV", () => {
    const csv = [
      "date,type,primary_category,amount_cents,account,currency",
      "2026-01-01,expense,Food,1500,Cash,CNY",
      "2026-01-02,income,Salary,500000,Bank,CNY",
    ].join("\n");
    const result = parseCsvImport(csv);
    expect(result.transactions).toHaveLength(2);
    expect(result.transfers).toHaveLength(0);
    const firstTx = result.transactions[0];
    expect(firstTx?.amount_cents).toBe(1500);
    expect(firstTx?.type).toBe("expense");
    expect(result.errors).toHaveLength(0);
  });

  test("parses transfer CSV", () => {
    const csv = [
      "date,inflow_amount_cents,outflow_amount_cents,account,currency",
      "2026-01-01,10000,10000,Bank,CNY",
    ].join("\n");
    const result = parseCsvImport(csv);
    expect(result.transfers).toHaveLength(1);
    expect(result.transactions).toHaveLength(0);
    expect(result.transfers[0]?.inflow_amount_cents).toBe(10000);
  });

  test("returns error for empty CSV", () => {
    const result = parseCsvImport("");
    expect(result.errors[0]).toContain("empty");
  });

  test("returns error for header-only CSV", () => {
    const result = parseCsvImport("date,type,amount");
    expect(result.errors[0]).toContain("empty");
  });

  test("returns error for unrecognized columns", () => {
    const csv = "foo,bar,baz\n1,2,3";
    const result = parseCsvImport(csv);
    expect(result.errors[0]).toContain("Cannot detect CSV type");
  });

  test("handles quoted fields with commas", () => {
    const csv = [
      "date,type,primary_category,amount_cents,account,note",
      '2026-01-01,expense,Food,1500,Cash,"lunch, dinner"',
    ].join("\n");
    const result = parseCsvImport(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.note).toBe("lunch, dinner");
  });

  test("handles tags as pipe-separated values", () => {
    const csv = [
      "date,type,primary_category,amount_cents,account,tags",
      "2026-01-01,expense,Food,1500,Cash,tag1|tag2|tag3",
    ].join("\n");
    const result = parseCsvImport(csv);
    expect(result.transactions[0]?.tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  test("reports column count mismatch", () => {
    const csv = ["date,type,primary_category,amount_cents,account", "2026-01-01,expense,Food"].join(
      "\n",
    );
    const result = parseCsvImport(csv);
    expect(result.transactions).toHaveLength(0);
    expect(result.errors[0]).toContain("expected 5 columns, got 3");
  });

  test("handles Windows-style line endings", () => {
    const csv =
      "date,type,primary_category,amount_cents,account\r\n2026-01-01,expense,Food,1500,Cash";
    const result = parseCsvImport(csv);
    expect(result.transactions).toHaveLength(1);
  });
});

// ── Auto-detect ──

describe("parseImportFile", () => {
  test("routes .json files to JSON parser", () => {
    const result = parseImportFile('{"transactions": []}', "backup.json");
    expect(result.errors).toHaveLength(0);
  });

  test("routes .csv files to CSV parser", () => {
    const csv = "date,type,primary_category,amount_cents,account\n2026-01-01,expense,Food,100,Cash";
    const result = parseImportFile(csv, "data.csv");
    expect(result.transactions).toHaveLength(1);
  });

  test("returns error for unsupported format", () => {
    const result = parseImportFile("data", "file.xlsx");
    expect(result.errors[0]).toContain("Unsupported file format");
  });
});
