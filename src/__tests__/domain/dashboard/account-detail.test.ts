import { describe, expect, it } from "bun:test";
import {
  buildAccountDetailData,
  buildAccountsByType,
  buildBalanceEntries,
  buildUniqueAccounts,
  sortDisplayEntries,
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

  it("builds account detail data with summary", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, "平安-主卡", 2024, []);
    expect(detail.summary?.totalIncome).toBe(1000);
  });

  it("sorts display entries", () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, "平安-主卡", 2024, []);
    const sorted = sortDisplayEntries(
      detail.displayEntries,
      "amount",
      "desc",
    );
    expect(sorted.length).toBe(detail.displayEntries.length);
  });
});
