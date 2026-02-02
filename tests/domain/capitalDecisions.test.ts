import { describe, expect, it } from 'bun:test';
import { classifyDecisions, sortDecisions } from '../../src/domain/assets/capitalDecisions';

describe('capitalDecisions domain', () => {
  it('classifies idle unit as high urgency', () => {
    const decisions = classifyDecisions([
      {
        id: '1',
        unit_code: 'A01',
        amount: 100,
        currency: 'CNY',
        status: '已成立',
        strategy: '长期理财',
        tactics: '稳健理财',
      } as any,
    ]);
    expect(decisions[0].urgency).toBe('high');
  });

  it('sorts by urgency', () => {
    const decisions = [
      { urgency: 'low', unit: { unit_code: 'B' }, details: 'b' } as any,
      { urgency: 'high', unit: { unit_code: 'A' }, details: 'a' } as any,
    ];
    const sorted = sortDecisions(decisions, '紧急度', 'asc');
    expect(sorted[0].urgency).toBe('high');
  });
});
