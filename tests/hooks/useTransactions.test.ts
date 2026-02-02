import { describe, it, expect, beforeEach, afterEach, mock, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import * as React from 'react';

const mockLoadLatestYearOnly = vi.fn();
const mockLoadRemainingYears = vi.fn();
const mockDeleteYearData = vi.fn();
const mockClearAllData = vi.fn();
const mockLoadAllYears = vi.fn();

const setup = async () => {
  mock.module('../../src/contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'user-1' } }),
  }));

  mock.module('../../src/hooks/useSupabaseTransactions', () => ({
    useSupabaseTransactions: () => ({
      loadLatestYearOnly: mockLoadLatestYearOnly,
      loadRemainingYears: mockLoadRemainingYears,
      deleteYearData: mockDeleteYearData,
      clearAllData: mockClearAllData,
      loadAllYears: mockLoadAllYears,
    }),
  }));

  mock.module('../../src/lib/supabase', () => ({
    supabase: {
      from: vi.fn(),
    },
  }));

  mock.module('../../src/lib/csvParser', () => ({
    parseCSVFile: vi.fn().mockResolvedValue({
      success: true,
      transactions: [],
      errors: [],
      warnings: [],
    }),
  }));

  mock.module('../../src/lib/dataLayer', () => ({
    createDataLayerManager: () => ({
      loadRaw: vi.fn(),
      validate: vi.fn().mockReturnValue([]),
      getMetrics: vi.fn().mockReturnValue({
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        missingCategory: 0,
        missingAccount: 0,
      }),
    }),
  }));

  return await import(`../../src/hooks/useTransactions?test=${Date.now()}`);
};

describe('useTransactions', () => {
  let useEffectSpy: ReturnType<typeof vi.spyOn>;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useEffectSpy = vi.spyOn(React, 'useEffect').mockImplementation(() => {});
    setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      _handler: TimerHandler,
      _timeout?: number,
      ..._args: unknown[]
    ) => 0 as unknown as ReturnType<typeof setTimeout>) as unknown as typeof setTimeout);
    mockLoadLatestYearOnly.mockReset();
    mockLoadRemainingYears.mockReset();
    mockDeleteYearData.mockReset();
    mockClearAllData.mockReset();
    mockLoadAllYears.mockReset();
  });

  afterEach(() => {
    useEffectSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('loads latest year data', async () => {
    mockLoadLatestYearOnly.mockResolvedValue({
      year: 2024,
      transactions: [{
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
      }],
    });
    mockLoadRemainingYears.mockResolvedValue([]);

    const { useTransactions } = await setup();
    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      await result.current.loadStoredData();
    });

    expect(mockLoadLatestYearOnly).toHaveBeenCalled();
  });

  it('handles delete and clear operations', async () => {
    mockLoadLatestYearOnly.mockResolvedValue({
      year: 2024,
      transactions: [{
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
      }],
    });
    mockLoadRemainingYears.mockResolvedValue([]);
    mockDeleteYearData.mockResolvedValue({ success: true });
    mockClearAllData.mockResolvedValue({ success: true });

    const { useTransactions } = await setup();
    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      await result.current.loadStoredData();
    });

    await act(async () => {
      await result.current.deleteYearData(2024);
    });

    await act(async () => {
      await result.current.clearAll();
    });

    expect(mockDeleteYearData).toHaveBeenCalled();
    expect(mockClearAllData).toHaveBeenCalled();
  });
});
