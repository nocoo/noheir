import { describe, expect, it } from 'bun:test';
import { clampReturnRate } from '../../src/domain/settings/returnRate';

describe('returnRate domain', () => {
  it('clamps return rate', () => {
    expect(clampReturnRate(-1, 0, 10)).toBe(0);
    expect(clampReturnRate(20, 0, 10)).toBe(10);
    expect(clampReturnRate(5, 0, 10)).toBe(5);
  });

  it('handles non-finite values', () => {
    expect(clampReturnRate(Number.NaN, 0, 10)).toBe(0);
  });
});
