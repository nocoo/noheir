import { describe, expect, test } from "vitest";
import { toIso, wire } from "../src/financial-service";

describe("toIso", () => {
  test("null and undefined → null", () => {
    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
  });

  test("integer seconds and milliseconds match legacy wire scaling", () => {
    expect(toIso(1751435509)).toBe(new Date(1751435509 * 1000).toISOString());
    expect(toIso(1784956591451)).toBe(new Date(1784956591451).toISOString());
    expect(toIso(1e12)).toBe(new Date(1e12).toISOString());
    expect(toIso(1e12 - 1)).toBe(new Date((1e12 - 1) * 1000).toISOString());
  });

  test("numeric strings follow the same rules as numbers", () => {
    expect(toIso("1751435509")).toBe(new Date(1751435509 * 1000).toISOString());
    expect(toIso("1784956591451")).toBe(new Date(1784956591451).toISOString());
  });

  test("ISO-8601 and SQLite datetime strings parse to UTC ISO", () => {
    const iso = "2026-04-07T08:00:00.000Z";
    expect(toIso(iso)).toBe(iso);
    expect(toIso("2026-04-07 08:00:00")).toBe(iso);
    expect(toIso("2026-04-07 08:00:00.000")).toBe(iso);
  });

  test("garbage, zero and out-of-range values → null", () => {
    expect(toIso("not-a-timestamp")).toBeNull();
    expect(toIso(0)).toBeNull();
    expect(toIso("")).toBeNull();
    expect(toIso(Number.NaN)).toBeNull();
    expect(toIso(8640000000000001)).toBeNull();
  });
});

describe("wire", () => {
  test("normalizes legacy ISO-text timestamps on products and units", () => {
    const iso = "2026-04-07T08:00:00.000Z";
    const product = wire({
      id: "p1",
      user_id: "owner",
      name: "Fund",
      currency: "CNY",
      version: 1,
      created_at: iso,
      updated_at: iso,
    });
    expect(product.createdAt).toBe(iso);
    expect(product.updatedAt).toBe(iso);

    const unit = wire({
      id: "u1",
      user_id: "owner",
      unit_code: "U1",
      amount_cents: 100,
      created_at: iso,
      updated_at: iso,
      deleted_at: null,
    });
    expect(unit.createdAt).toBe(iso);
    expect(unit.deletedAt).toBeNull();
  });

  test("malformed tags JSON does not throw", () => {
    expect(
      wire({
        id: "t1",
        user_id: "owner",
        tags: "{not-json",
      }).tags,
    ).toEqual([]);
  });
});
