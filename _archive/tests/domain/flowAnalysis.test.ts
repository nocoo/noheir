import { describe, expect, it } from 'bun:test';
import { buildFlowTabs, buildFlowTitle, buildFlowTransactions } from '../../src/domain/dashboard/flowAnalysis';

describe('flowAnalysis domain', () => {
  it('builds tabs and title', () => {
    const tabs = buildFlowTabs();
    const title = buildFlowTitle();
    expect(tabs.length).toBe(2);
    expect(title.title).toBe('流向分析');
  });

  it('passes through transactions', () => {
    const tx = [{
      id: '1',
      date: '2024-01-01',
      year: 2024,
      month: 1,
      primaryCategory: '收入',
      secondaryCategory: '工资',
      tertiaryCategory: '月薪',
      amount: 100,
      account: 'A',
      type: 'income',
    }];
    const result = buildFlowTransactions(tx);
    expect(result.length).toBe(1);
  });
});
