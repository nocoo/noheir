import { describe, expect, it } from 'bun:test';
import { buildStrategyHierarchy, buildTotalAmount } from '../../src/domain/assets/strategySunburst';

describe('strategySunburst domain', () => {
  it('builds hierarchy with root name', () => {
    const data = buildStrategyHierarchy([], '资产');
    expect(data.name).toBe('资产');
  });

  it('calculates total amount', () => {
    const total = buildTotalAmount([
      { status: '已成立', amount: 10 } as any,
      { status: '计划中', amount: 20 } as any,
    ]);
    expect(total).toBe(10);
  });
});
