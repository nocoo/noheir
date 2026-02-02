import { describe, expect, it } from 'bun:test';
import {
  buildYearStatusMap,
  calculateTotals,
  getAllYears,
} from '../../src/domain/dataManagement';

describe('dataManagement domain', () => {
  it('builds year status map with missing data', () => {
    const map = buildYearStatusMap(
      [{
        year: 2024,
        transactions: [],
        recordCount: 1,
        importedAt: '2024-01-01',
        updatedAt: '2024-01-01',
        metadata: { totalIncome: 10, totalExpense: 5 },
      }],
      []
    );

    const status = map.get(2024);
    expect(status?.hasTransfers).toBe(false);
    expect(status?.missing).toContain('转账数据');
  });

  it('marks complete when both data types exist', () => {
    const map = buildYearStatusMap(
      [{
        year: 2024,
        transactions: [],
        recordCount: 1,
        importedAt: '2024-01-01',
        updatedAt: '2024-01-01',
        metadata: { totalIncome: 10, totalExpense: 5 },
      }],
      [{
        year: 2024,
        transfers: [],
        recordCount: 2,
        importedAt: '2024-01-02',
        updatedAt: '2024-01-02',
        metadata: { totalInflow: 10, totalOutflow: 5 },
      }]
    );

    const status = map.get(2024);
    expect(status?.isComplete).toBe(true);
    expect(status?.missing.length).toBe(0);
  });

  it('calculates totals', () => {
    const totals = calculateTotals(
      [{
        year: 2024,
        transactions: [],
        recordCount: 3,
        importedAt: '2024-01-01',
        updatedAt: '2024-01-01',
        metadata: { totalIncome: 100, totalExpense: 40 },
      }],
      [{
        year: 2024,
        transfers: [],
        recordCount: 2,
        importedAt: '2024-01-02',
        updatedAt: '2024-01-02',
        metadata: { totalInflow: 20, totalOutflow: 10 },
      }]
    );

    expect(totals.totalRecords).toBe(3);
    expect(totals.totalTransferRecords).toBe(2);
  });

  it('sorts years descending', () => {
    const map = buildYearStatusMap([
      {
        year: 2023,
        transactions: [],
        recordCount: 1,
        importedAt: '2023-01-01',
        updatedAt: '2023-01-01',
        metadata: { totalIncome: 0, totalExpense: 0 },
      },
      {
        year: 2024,
        transactions: [],
        recordCount: 1,
        importedAt: '2024-01-01',
        updatedAt: '2024-01-01',
        metadata: { totalIncome: 0, totalExpense: 0 },
      },
    ], []);

    const years = getAllYears(map).map(y => y.year);
    expect(years).toEqual([2024, 2023]);
  });
});
