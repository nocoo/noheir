import { describe, expect, it } from "vitest";
import {
  buildAccountData,
  buildAccountGroups,
  buildAccountSummaryStats,
  buildChartData,
  buildPieData,
} from "@/domain/dashboard/account-analysis";
import type { DomainTransaction } from "@/domain/types";

const sampleTransactions: DomainTransaction[] = [
  {
    id: "1",
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
    id: "2",
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
  {
    id: "3",
    date: "2024-01-04",
    year: 2024,
    month: 1,
    primaryCategory: "投资",
    secondaryCategory: "基金",
    tertiaryCategory: "定投",
    amount: 500,
    account: "支付宝-基金",
    type: "income",
    currency: "CNY",
    tags: [],
    note: "定投",
  },
];

describe("account-analysis domain", () => {
  it("builds account data", () => {
    const data = buildAccountData(sampleTransactions);
    const main = data.find((item) => item.name === "平安-主卡");
    expect(main?.income).toBe(1000);
    expect(main?.expense).toBe(200);
    expect(main?.transactionCount).toBe(2);
  });

  it("builds grouped data", () => {
    const data = buildAccountData(sampleTransactions);
    const groups = buildAccountGroups(data, "prefix");
    const groupNames = groups.map((group) => group.prefix);
    expect(groupNames).toContain("平安");
  });

  it("builds pie data with percentages", () => {
    const data = buildAccountData(sampleTransactions);
    const pieData = buildPieData(data, 1);
    expect(pieData.length).toBeGreaterThan(0);
    expect(pieData[0]?.percentage).toBeGreaterThan(0);
  });

  it("builds chart data", () => {
    const data = buildAccountData(sampleTransactions);
    const chartData = buildChartData(data);
    expect(chartData[0]).toHaveProperty("income");
  });

  it("builds summary stats", () => {
    const data = buildAccountData(sampleTransactions);
    const summary = buildAccountSummaryStats(data, sampleTransactions);
    expect(summary.accountCount).toBe(2);
    expect(summary.totalTransactions).toBe(3);
  });
});
