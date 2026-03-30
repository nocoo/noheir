import { describe, expect, it } from 'bun:test';
import {
  buildFinancialHealthResult,
  buildSafeMonthlyData,
  buildSafeTotalIncome,
} from '../../src/domain/dashboard/financialHealth';

describe('financialHealth domain', () => {
  it('builds safe monthly data', () => {
    expect(buildSafeMonthlyData([])).toEqual([]);
  });

  it('builds safe total income', () => {
    expect(buildSafeTotalIncome(Number.NaN)).toBe(0);
  });

  it('builds health result', () => {
    const result = buildFinancialHealthResult([], [], 0, []);
    expect(result.maxScore).toBe(100);
  });
});
