import { describe, expect, it } from "bun:test";
import {
  buildAccountDetailData,
  buildAccountsByType,
  buildAccountType,
  buildBalanceEntries,
  buildUniqueAccounts,
  sortDisplayEntries,
  type DisplayEntry,
} from "@/domain/dashboard/account-detail";
import type { DomainTransaction, DomainTransfer } from "@/domain/types";

const transactions: DomainTransaction[] = [
  {
    id: "t1",
    date: "2024-01-02",
    year: 2024,
    month: 1,
    primaryCategory: "工资",
    secondaryCategory: "本职",
    tertiaryCategory: "月薪",
    amount: 1000,
    account: "平安-主卡",
    type: "income",
    currency: "CNY",
    tags: [],
    note: "工资",
  },
  {
    id: "t2",
    date: "2024-01-03",
    year: 2024,
    month: 1,
    primaryCategory: "餐饮",
    secondaryCategory: "午餐",
    tertiaryCategory: "快餐",
    amount: 200,
    account: "平安-主卡",
    type: "expense",
    currency: "CNY",
    tags: [],
    note: "午餐",
  },
];

const transfers: DomainTransfer[] = [
  {
    id: "tr1",
    date: "2024-01-04",
    year: 2024,
    month: 1,
    day: 4,
    primaryCategory: null,
    secondaryCategory: "转账",
    transactionType: "转账",
    inflowAmount: 300,
    outflowAmount: 300,
    currency: "CNY",
    account: "平安-主卡 → 支付宝-基金",
    tags: [],
    note: "转账",
  },
];

describe("account-detail domain", () => {
  it("builds balance entries from transactions and transfers", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    expect(entries.length).toBe(4);
    // Sorted by date
    expect(entries[0]?.date).toBe("2024-01-02");
  });

  it("builds unique accounts and groups by type", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const accounts = buildUniqueAccounts(entries);
    expect(accounts).toContain("平安-主卡");

    const grouped = buildAccountsByType(accounts, [
      { accountName: "平安-主卡", type: "debit" },
    ]);
    expect(grouped.debit).toContain("平安-主卡");
  });

  it("groups unclassified when no accountTypes provided", () => {
    const grouped = buildAccountsByType(["未知账户"], undefined);
    expect(grouped.unclassified).toContain("未知账户");
  });

  it("builds account detail data with summary", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, "平安-主卡", 2024, []);
    expect(detail.summary?.totalIncome).toBe(1000);
    expect(detail.summary?.totalExpense).toBe(200);
  });

  it("returns empty data when selectedAccount is empty", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, "", 2024, []);
    expect(detail.dailyBalances).toEqual([]);
    expect(detail.displayEntries).toEqual([]);
    expect(detail.summary).toBeNull();
  });

  it("returns empty data when no entries match account", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, "不存在的账户", 2024, []);
    expect(detail.dailyBalances).toEqual([]);
    expect(detail.displayEntries).toEqual([]);
    expect(detail.summary).toBeNull();
  });

  it("handles balance anchors within year", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const anchors = [
      { accountName: "平安-主卡", date: "2024-03-01", balance: 5000 },
    ];
    const detail = buildAccountDetailData(entries, "平安-主卡", 2024, anchors);
    expect(detail.displayAnchors).toHaveLength(1);
    // Anchor should appear in display entries
    const anchorEntries = detail.displayEntries.filter((e) => e.isAnchor);
    expect(anchorEntries.length).toBeGreaterThanOrEqual(1);
    expect(anchorEntries[0]?.primaryCategory).toBe("余额锚点");
  });

  it("uses starting anchor from before year", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const anchors = [
      { accountName: "平安-主卡", date: "2023-12-31", balance: 2000 },
    ];
    const detail = buildAccountDetailData(entries, "平安-主卡", 2024, anchors);
    expect(detail.summary?.initialBalance).toBe(2000);
    expect(detail.summary?.hasAnchor).toBe(true);
  });

  it("handles anchors on the same date as transactions", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const anchors = [
      { accountName: "平安-主卡", date: "2024-01-02", balance: 800 },
    ];
    const detail = buildAccountDetailData(entries, "平安-主卡", 2024, anchors);
    expect(detail.displayAnchors).toHaveLength(1);
  });

  it("builds detail with no anchors (fallback to 0)", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, "平安-主卡", 2024, undefined);
    expect(detail.summary?.initialBalance).toBe(0);
    expect(detail.summary?.hasAnchor).toBe(false);
  });
});

describe("buildAccountType", () => {
  it("returns matched type", () => {
    expect(
      buildAccountType("平安-主卡", [{ accountName: "平安-主卡", type: "debit" }]),
    ).toBe("debit");
  });

  it("returns unclassified when no match", () => {
    expect(buildAccountType("未知", [{ accountName: "平安-主卡", type: "debit" }])).toBe(
      "unclassified",
    );
  });

  it("returns unclassified when accountTypes is undefined", () => {
    expect(buildAccountType("任意", undefined)).toBe("unclassified");
  });
});

describe("sortDisplayEntries", () => {
  const baseEntry: DisplayEntry = {
    id: "1",
    date: "2024-01-01",
    primaryCategory: "餐饮",
    type: "expense",
    amount: 100,
    balance: 100,
    balanceAfter: 100,
  };

  it("returns empty for empty input", () => {
    expect(sortDisplayEntries([], "date", "asc")).toEqual([]);
  });

  it("sorts by amount desc", () => {
    const entries: DisplayEntry[] = [
      { ...baseEntry, id: "a", amount: 50 },
      { ...baseEntry, id: "b", amount: 200 },
    ];
    const sorted = sortDisplayEntries(entries, "amount", "desc");
    expect(sorted[0]?.id).toBe("b");
    expect(sorted[1]?.id).toBe("a");
  });

  it("sorts by amount asc", () => {
    const entries: DisplayEntry[] = [
      { ...baseEntry, id: "a", amount: 200 },
      { ...baseEntry, id: "b", amount: 50 },
    ];
    const sorted = sortDisplayEntries(entries, "amount", "asc");
    expect(sorted[0]?.id).toBe("b");
    expect(sorted[1]?.id).toBe("a");
  });

  it("anchors always come first", () => {
    const entries: DisplayEntry[] = [
      { ...baseEntry, id: "normal", date: "2024-01-01" },
      { ...baseEntry, id: "anchor", date: "2024-01-01", isAnchor: true, type: "anchor" },
    ];
    const sorted = sortDisplayEntries(entries, "amount", "asc");
    expect(sorted[0]?.id).toBe("anchor");
  });

  it("sorts anchors by date among themselves", () => {
    const entries: DisplayEntry[] = [
      { ...baseEntry, id: "a2", date: "2024-02-01", isAnchor: true, type: "anchor" },
      { ...baseEntry, id: "a1", date: "2024-01-01", isAnchor: true, type: "anchor" },
    ];
    const sorted = sortDisplayEntries(entries, "amount", "asc");
    expect(sorted[0]?.id).toBe("a1");
    expect(sorted[1]?.id).toBe("a2");
  });

  it("sorts by type using Chinese labels", () => {
    const entries: DisplayEntry[] = [
      { ...baseEntry, id: "inc", type: "income" },
      { ...baseEntry, id: "exp", type: "expense" },
      { ...baseEntry, id: "tfr", type: "transfer" },
    ];
    const sorted = sortDisplayEntries(entries, "type", "asc");
    // Chinese labels sort by Unicode code point:
    //   支出 (U+652F) < 收入 (U+6536) < 转账 (U+8F6C)
    expect(sorted.map((e) => e.id)).toEqual(["exp", "inc", "tfr"]);

    const sortedDesc = sortDisplayEntries(entries, "type", "desc");
    expect(sortedDesc.map((e) => e.id)).toEqual(["tfr", "inc", "exp"]);
  });

  it("sorts by primaryCategory", () => {
    const entries: DisplayEntry[] = [
      { ...baseEntry, id: "b", primaryCategory: "餐饮" },
      { ...baseEntry, id: "a", primaryCategory: "交通" },
      { ...baseEntry, id: "c", primaryCategory: undefined },
    ];
    const sorted = sortDisplayEntries(entries, "primaryCategory", "asc");
    // undefined -> "" comes first
    expect(sorted[0]?.id).toBe("c");
  });

  it("handles equal values in sort", () => {
    const entries: DisplayEntry[] = [
      { ...baseEntry, id: "a", amount: 100 },
      { ...baseEntry, id: "b", amount: 100 },
    ];
    const sorted = sortDisplayEntries(entries, "amount", "asc");
    expect(sorted).toHaveLength(2);
  });
});
