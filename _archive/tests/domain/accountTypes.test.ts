import { describe, expect, it } from 'bun:test';
import {
  applyBatchAccountTypes,
  buildAccountTypesUpdate,
  getUniqueAccounts,
  groupAccountsByType,
} from '../../src/domain/settings/accountTypes';

describe('accountTypes domain', () => {
  it('dedupes and sorts accounts', () => {
    const result = getUniqueAccounts([
      { account: 'B' },
      { account: 'A' },
      { account: 'A' },
    ]);
    expect(result).toEqual(['A', 'B']);
  });

  it('updates a single account type', () => {
    const updated = buildAccountTypesUpdate([], 'A', 'debit');
    expect(updated).toEqual([{ accountName: 'A', type: 'debit' }]);
  });

  it('applies batch update', () => {
    const updated = applyBatchAccountTypes([], ['A', 'B'], 'credit');
    expect(updated).toEqual([
      { accountName: 'A', type: 'credit' },
      { accountName: 'B', type: 'credit' },
    ]);
  });

  it('groups accounts by type', () => {
    const grouped = groupAccountsByType(['A', 'B'], [{ accountName: 'A', type: 'debit' }]);
    expect(grouped.debit).toEqual(['A']);
    expect(grouped.unclassified).toEqual(['B']);
  });
});
