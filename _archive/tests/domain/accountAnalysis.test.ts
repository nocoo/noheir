import { describe, expect, it } from 'bun:test';
import {
  buildAccountData,
  buildAccountGroups,
  buildAccountSummaryStats,
  buildChartData,
  buildPieData,
  buildTopTransactionCounts,
  getAccountPrefix,
} from '../../src/domain/dashboard/accountAnalysis';

const sampleTransactions = [
  {
    id: '1',
    date: '2024-01-02',
    year: 2024,
    month: 1,
    primaryCategory: '工资',
    secondaryCategory: '本职',
    tertiaryCategory: '月薪',
    amount: 1000,
    account: '平安-主卡',
    description: '工资',
    type: 'income',
  },
  {
    id: '2',
    date: '2024-01-03',
    year: 2024,
    month: 1,
    primaryCategory: '餐饮',
    secondaryCategory: '午餐',
    tertiaryCategory: '快餐',
    amount: 200,
    account: '平安-主卡',
    description: '午餐',
    type: 'expense',
  },
  {
    id: '3',
    date: '2024-01-04',
    year: 2024,
    month: 1,
    primaryCategory: '投资',
    secondaryCategory: '基金',
    tertiaryCategory: '定投',
    amount: 500,
    account: '支付宝-基金',
    description: '定投',
    type: 'income',
  },
];

describe('accountAnalysis domain', () => {
  it('extracts account prefix', () => {
    expect(getAccountPrefix('平安-主卡')).toBe('平安');
    expect(getAccountPrefix('现金')).toBe('现金');
  });

  it('builds account data', () => {
    const data = buildAccountData(sampleTransactions);
    const main = data.find(item => item.name === '平安-主卡');
    expect(main?.income).toBe(1000);
    expect(main?.expense).toBe(200);
    expect(main?.transactionCount).toBe(2);
  });

  it('builds grouped data', () => {
    const data = buildAccountData(sampleTransactions);
    const groups = buildAccountGroups(data, 'prefix');
    const groupNames = groups.map(group => group.prefix);
    expect(groupNames).toContain('平安');
  });

  it('builds pie data with percentages', () => {
    const data = buildAccountData(sampleTransactions);
    const pieData = buildPieData(data, 1);
    expect(pieData.length).toBeGreaterThan(0);
    expect(pieData[0].percentage).toBeGreaterThan(0);
  });

  it('builds chart data', () => {
    const data = buildAccountData(sampleTransactions);
    const chartData = buildChartData(data);
    expect(chartData[0]).toHaveProperty('收入');
  });

  it('builds top transaction counts', () => {
    const data = buildAccountData(sampleTransactions);
    const top = buildTopTransactionCounts(data, 1);
    expect(top.length).toBe(1);
  });

  it('builds summary stats', () => {
    const data = buildAccountData(sampleTransactions);
    const summary = buildAccountSummaryStats(data, sampleTransactions);
    expect(summary.accountCount).toBe(2);
    expect(summary.totalTransactions).toBe(3);
  });
});
