import { describe, expect, it } from 'bun:test';
import { clampSavingsRate, getSavingsRateTone } from '../../src/domain/settings/savingsRate';

describe('savingsRate domain', () => {
  it('clamps values to 0-100', () => {
    expect(clampSavingsRate(-10)).toBe(0);
    expect(clampSavingsRate(120)).toBe(100);
    expect(clampSavingsRate(60)).toBe(60);
  });

  it('handles non-finite values', () => {
    expect(clampSavingsRate(Number.NaN)).toBe(0);
  });

  it('evaluates tone', () => {
    expect(getSavingsRateTone(10)).toBe('low');
    expect(getSavingsRateTone(50)).toBe('ok');
    expect(getSavingsRateTone(80)).toBe('high');
  });
});
