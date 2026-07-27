import { describe, expect, test } from "vitest";
import { toDomainContributionLog } from "@/lib/capital-mappers";

describe("toDomainContributionLog", () => {
  const base = {
    id: "log-1",
    unitId: "unit-1",
    operationType: "withdraw",
    amountCents: -100000,
    operationDate: "2026-07-02",
    source: "manual",
    createdAt: 1784956591451,
  };

  test("converts pnlCents to yuan and keeps null", () => {
    expect(toDomainContributionLog({ ...base, pnlCents: 12345 }).pnl).toBe(123.45);
    expect(toDomainContributionLog({ ...base, pnlCents: -6789 }).pnl).toBe(-67.89);
    expect(toDomainContributionLog(base).pnl).toBeNull();
  });

  test("prefers the server-normalized createdAtMs", () => {
    const log = toDomainContributionLog({
      ...base,
      createdAt: "2026-07-02T05:51:49.226Z",
      createdAtMs: 1782971509226,
    });
    expect(log.createdAt.getTime()).toBe(1782971509226);
  });

  test("falls back to raw createdAt when createdAtMs is absent", () => {
    expect(toDomainContributionLog(base).createdAt.getTime()).toBe(1784956591451);
  });

  test("null createdAtMs still falls back rather than producing epoch 0", () => {
    const log = toDomainContributionLog({ ...base, createdAtMs: null });
    expect(log.createdAt.getTime()).toBe(1784956591451);
  });

  test("maps amount cents to yuan and derives isDeleted", () => {
    const log = toDomainContributionLog({ ...base, deletedAt: 123 });
    expect(log.amount).toBe(-1000);
    expect(log.isDeleted).toBe(true);
    expect(toDomainContributionLog(base).isDeleted).toBe(false);
  });
});
