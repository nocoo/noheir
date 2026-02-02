import { describe, expect, it } from 'bun:test';
import type { UnitDisplayInfo } from '../../src/types/assets';
import { classifyDecisions, sortDecisions } from '../../src/domain/assets/capitalDecisions';

describe('capitalDecisions domain', () => {
  it('classifies idle unit as high urgency', () => {
    const unit: UnitDisplayInfo = {
      id: '1',
      user_id: 'u1',
      unit_code: 'A01',
      amount: 100,
      currency: 'CNY',
      status: '已成立',
      strategy: '长期理财',
      tactics: '稳健理财',
      created_at: '2024-01-01',
    };
    const decisions = classifyDecisions([unit]);
    expect(decisions[0].urgency).toBe('high');
  });

  it('sorts by urgency', () => {
    const decisions = [
      { urgency: 'low' as const, reason: 'x', unit: { unit_code: 'B', strategy: '长期理财' }, details: 'b' },
      { urgency: 'high' as const, reason: 'x', unit: { unit_code: 'A', strategy: '长期理财' }, details: 'a' },
    ];
    const sorted = sortDecisions(decisions, '紧急度', 'asc');
    expect(sorted[0].urgency).toBe('high');
  });
});
