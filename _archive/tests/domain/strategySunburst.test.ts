import { describe, expect, it } from 'bun:test';
import type { UnitDisplayInfo } from '../../src/types/assets';
import { buildStrategyHierarchy, buildTotalAmount } from '../../src/domain/assets/strategySunburst';

describe('strategySunburst domain', () => {
  it('builds hierarchy with root name', () => {
    const data = buildStrategyHierarchy([], '资产');
    expect(data.name).toBe('资产');
  });

  it('calculates total amount', () => {
    const units: UnitDisplayInfo[] = [
      {
        id: '1',
        user_id: 'u1',
        unit_code: 'A01',
        amount: 10,
        currency: 'CNY',
        status: '已成立',
        strategy: '长期理财',
        tactics: '稳健理财',
        created_at: '2024-01-01',
      },
      {
        id: '2',
        user_id: 'u1',
        unit_code: 'A02',
        amount: 20,
        currency: 'CNY',
        status: '计划中',
        strategy: '长期理财',
        tactics: '稳健理财',
        created_at: '2024-01-01',
      },
    ];
    const total = buildTotalAmount(units);
    expect(total).toBe(10);
  });
});
