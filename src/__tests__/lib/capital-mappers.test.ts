import { describe, expect, test } from "vitest";
import { toDomainContributionLog, toUnitDisplayInfo } from "@/lib/capital-mappers";

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

describe("toUnitDisplayInfo", () => {
  test("maps populated unit and product fields", () => {
    const unit = toUnitDisplayInfo({
      id: "u1",
      version: 2,
      unitCode: "A01",
      amountCents: 250000,
      currency: "USD",
      status: "已成立",
      strategy: "远期理财",
      tactics: "定期存款",
      productId: "p1",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      note: "memo",
      availableDate: "2026-12-31",
      availableDateOverride: "2026-11-01",
      isAvailable: true,
      daysUntilAvailable: 0,
      daysUntilLocked: 10,
      latestInvestDate: "2026-01-01",
      product: {
        id: "p1",
        version: 1,
        name: "Deposit",
        code: "D01",
        channel: "Bank",
        category: "Fixed",
        currency: "USD",
        lockPeriodDays: 365,
        openDays: 5,
        cycleDays: 30,
        annualReturnRate: 0.04,
        isArchived: false,
      },
    });
    expect(unit.amount).toBe(2500);
    expect(unit.product?.code).toBe("D01");
    expect(unit.availableDateOverride).toBe("2026-11-01");
  });

  test("defaults nullable fields when omitted", () => {
    const unit = toUnitDisplayInfo({ version: 1, product: {} });
    expect(unit.currency).toBe("CNY");
    expect(unit.productId).toBeNull();
    expect(unit.product?.lockPeriodDays).toBeNull();
    expect(unit.daysUntilAvailable).toBeNull();
  });
});
