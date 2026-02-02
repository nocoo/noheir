import { describe, expect, it } from 'bun:test';
import { buildMonthlyMaturities, buildSummaryStats } from '../../src/domain/assets/liquidityLadder';

describe('liquidityLadder domain', () => {
  it('builds empty data when no units', () => {
    const data = buildMonthlyMaturities([]);
    expect(data.months.length).toBe(0);
  });

  it('builds summary stats', () => {
    const data = {
      monthlyMaturities: [
        { month: '2024-01', monthLabel: '2024年1月', strategy: 'A', amount: 10 },
      ],
      months: ['2024-01'],
      strategies: ['A'],
    };
    const summary = buildSummaryStats(data);
    expect(summary.total).toBe(10);
  });
});
