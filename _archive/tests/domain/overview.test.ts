import { describe, expect, it } from 'bun:test';
import { buildSavingsRate } from '../../src/domain/dashboard/overview';

describe('overview domain', () => {
  it('returns zero when income is zero', () => {
    expect(buildSavingsRate(0, 100)).toBe(0);
  });

  it('calculates savings rate', () => {
    expect(buildSavingsRate(1000, 200)).toBeCloseTo(80);
  });
});
