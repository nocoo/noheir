import { describe, it, expect } from "vitest";
import {
  parseTags,
  toDomainTransaction,
  toDomainTransfer,
  buildMonthlyData,
} from "@/lib/transaction-mappers";

describe("parseTags", () => {
  it("parses JSON string to array", () => {
    expect(parseTags('["餐饮","工作餐"]')).toEqual(["餐饮", "工作餐"]);
  });

  it("handles empty JSON array string", () => {
    expect(parseTags("[]")).toEqual([]);
  });

  it("handles array input directly", () => {
    expect(parseTags(["tag1", "tag2"])).toEqual(["tag1", "tag2"]);
  });

  it("handles empty array", () => {
    expect(parseTags([])).toEqual([]);
  });

  it("handles null", () => {
    expect(parseTags(null)).toEqual([]);
  });

  it("handles undefined", () => {
    expect(parseTags(undefined)).toEqual([]);
  });

  it("handles empty string", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("handles malformed JSON gracefully", () => {
    expect(parseTags("not-json")).toEqual([]);
  });

  it("handles JSON object (not array) gracefully", () => {
    expect(parseTags('{"key":"value"}')).toEqual([]);
  });

  it("filters non-string values from array", () => {
    expect(parseTags([1, "valid", null, "also-valid"])).toEqual(["valid", "also-valid"]);
  });

  it("filters non-string values from parsed JSON", () => {
    expect(parseTags('[1, "valid", null, "also-valid"]')).toEqual(["valid", "also-valid"]);
  });
});

describe("toDomainTransaction", () => {
  it("maps all fields correctly", () => {
    const raw = {
      id: "tx-1",
      date: "2026-01-15",
      year: 2026,
      month: 1,
      primaryCategory: "餐饮",
      secondaryCategory: "午餐",
      tertiaryCategory: "快餐",
      amountCents: 5000,
      account: "支付宝",
      type: "expense",
      currency: "CNY",
      tags: '["工作餐","报销"]',
      note: "团队午餐",
    };
    const result = toDomainTransaction(raw);
    expect(result.id).toBe("tx-1");
    expect(result.date).toBe("2026-01-15");
    expect(result.year).toBe(2026);
    expect(result.month).toBe(1);
    expect(result.primaryCategory).toBe("餐饮");
    expect(result.secondaryCategory).toBe("午餐");
    expect(result.tertiaryCategory).toBe("快餐");
    expect(result.amount).toBe(50);
    expect(result.account).toBe("支付宝");
    expect(result.type).toBe("expense");
    expect(result.currency).toBe("CNY");
    expect(result.tags).toEqual(["工作餐", "报销"]);
    expect(result.note).toBe("团队午餐");
  });

  it("maps income type correctly", () => {
    const result = toDomainTransaction({ type: "income" });
    expect(result.type).toBe("income");
  });

  it("defaults non-income type to expense", () => {
    const result = toDomainTransaction({ type: "other" });
    expect(result.type).toBe("expense");
  });

  it("handles null secondaryCategory and note", () => {
    const result = toDomainTransaction({
      secondaryCategory: null,
      note: null,
    });
    expect(result.secondaryCategory).toBeNull();
    expect(result.note).toBeNull();
  });

  it("handles missing fields with defaults", () => {
    const result = toDomainTransaction({});
    expect(result.id).toBe("");
    expect(result.date).toBe("");
    expect(result.year).toBe(0);
    expect(result.month).toBe(0);
    expect(result.amount).toBe(0);
    expect(result.currency).toBe("CNY");
    expect(result.tags).toEqual([]);
  });
});

describe("toDomainTransfer", () => {
  it("maps all fields correctly", () => {
    const raw = {
      id: "tf-1",
      date: "2026-02-10",
      year: 2026,
      month: 2,
      day: 10,
      primaryCategory: "理财",
      secondaryCategory: "转入",
      transactionType: "转账",
      inflowAmountCents: 100000,
      outflowAmountCents: 100000,
      currency: "USD",
      account: "招商银行",
      tags: '["投资"]',
      note: "基金转账",
    };
    const result = toDomainTransfer(raw);
    expect(result.id).toBe("tf-1");
    expect(result.date).toBe("2026-02-10");
    expect(result.year).toBe(2026);
    expect(result.month).toBe(2);
    expect(result.day).toBe(10);
    expect(result.primaryCategory).toBe("理财");
    expect(result.secondaryCategory).toBe("转入");
    expect(result.transactionType).toBe("转账");
    expect(result.inflowAmount).toBe(1000);
    expect(result.outflowAmount).toBe(1000);
    expect(result.currency).toBe("USD");
    expect(result.account).toBe("招商银行");
    expect(result.tags).toEqual(["投资"]);
    expect(result.note).toBe("基金转账");
  });

  it("handles null optional fields", () => {
    const result = toDomainTransfer({
      primaryCategory: null,
      secondaryCategory: null,
      transactionType: null,
      note: null,
    });
    expect(result.primaryCategory).toBeNull();
    expect(result.secondaryCategory).toBeNull();
    expect(result.transactionType).toBeNull();
    expect(result.note).toBeNull();
  });

  it("handles missing fields with defaults", () => {
    const result = toDomainTransfer({});
    expect(result.id).toBe("");
    expect(result.day).toBe(0);
    expect(result.inflowAmount).toBe(0);
    expect(result.outflowAmount).toBe(0);
    expect(result.currency).toBe("CNY");
    expect(result.tags).toEqual([]);
  });
});

describe("buildMonthlyData", () => {
  it("aggregates income and expense by month", () => {
    const txs = [
      {
        id: "1",
        date: "2026-01-01",
        year: 2026,
        month: 1,
        primaryCategory: "工资",
        secondaryCategory: null,
        tertiaryCategory: "",
        amount: 10000,
        account: "A",
        type: "income" as const,
        currency: "CNY",
        tags: [],
        note: null,
      },
      {
        id: "2",
        date: "2026-01-15",
        year: 2026,
        month: 1,
        primaryCategory: "餐饮",
        secondaryCategory: null,
        tertiaryCategory: "",
        amount: 3000,
        account: "A",
        type: "expense" as const,
        currency: "CNY",
        tags: [],
        note: null,
      },
      {
        id: "3",
        date: "2026-02-01",
        year: 2026,
        month: 2,
        primaryCategory: "工资",
        secondaryCategory: null,
        tertiaryCategory: "",
        amount: 8000,
        account: "A",
        type: "income" as const,
        currency: "CNY",
        tags: [],
        note: null,
      },
    ];
    const result = buildMonthlyData(txs);
    expect(result).toHaveLength(12);
    expect(result[0]?.month).toBe("一月");
    expect(result[0]?.income).toBe(10000);
    expect(result[0]?.expense).toBe(3000);
    expect(result[0]?.balance).toBe(7000);
    expect(result[1]?.income).toBe(8000);
    expect(result[1]?.expense).toBe(0);
    expect(result[1]?.balance).toBe(8000);
    // Months with no transactions
    expect(result[2]?.income).toBe(0);
    expect(result[2]?.expense).toBe(0);
    expect(result[2]?.balance).toBe(0);
  });

  it("returns 12 empty months for empty input", () => {
    const result = buildMonthlyData([]);
    expect(result).toHaveLength(12);
    result.forEach((m) => {
      expect(m.income).toBe(0);
      expect(m.expense).toBe(0);
      expect(m.balance).toBe(0);
    });
  });

  it("skips transactions with invalid month index", () => {
    const txs = [
      {
        id: "1",
        date: "2026-13-01",
        year: 2026,
        month: 13,
        primaryCategory: "",
        secondaryCategory: null,
        tertiaryCategory: "",
        amount: 100,
        account: "A",
        type: "income" as const,
        currency: "CNY",
        tags: [],
        note: null,
      },
    ];
    const result = buildMonthlyData(txs);
    // Month 13 is out of range, entry[12] is undefined, so it should be skipped
    const total = result.reduce((s, m) => s + m.income, 0);
    expect(total).toBe(0);
  });
});
