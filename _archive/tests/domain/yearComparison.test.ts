import { describe, expect, it } from 'bun:test';
import { buildYearComparisonChartData } from '../../src/domain/dashboard/yearComparison';

describe('yearComparison domain', () => {
  it('builds chart data', () => {
    const data = [{
      year: 2024,
      totalIncome: 1000,
      totalExpense: 400,
      balance: 600,
      categoryBreakdown: [],
    }];
    const chartData = buildYearComparisonChartData(data);
    expect(chartData[0].year).toBe('2024');
  });
});
