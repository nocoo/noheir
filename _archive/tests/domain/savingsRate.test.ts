import { describe, expect, it } from 'bun:test';
import { buildSavingsRateChartData, buildSavingsRateSummary } from '../../src/domain/dashboard/savingsRate';

describe('savingsRate domain', () => {
  it('builds chart data and summary', () => {
    const data = [
      { month: '1月', income: 1000, expense: 400, balance: 600 },
      { month: '2月', income: 0, expense: 0, balance: 0 },
    ];
    const { chartData, totals } = buildSavingsRateChartData(data);
    expect(chartData[0].savingsRate).toBeCloseTo(60);
    const summary = buildSavingsRateSummary(totals, 30);
    expect(summary.annualSavingsRate).toBeGreaterThan(0);
  });
});
