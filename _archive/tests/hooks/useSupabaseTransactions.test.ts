import { describe, it, expect, beforeEach, mock, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockLimit = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();

describe('useSupabaseTransactions', () => {
  beforeEach(() => {
    mock.module('../../src/contexts/AuthContext', () => ({
      useAuth: () => ({ user: { id: 'user-1' } }),
    }));

    mock.module('../../src/lib/supabase', () => ({
      supabase: {
        from: (...args: unknown[]) => mockFrom(...args),
      },
    }));

    mockFrom.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockOrder.mockReset();
    mockRange.mockReset();
    mockLimit.mockReset();
    mockDelete.mockReset();
    mockInsert.mockReset();

    mockFrom.mockReturnValue({
      select: mockSelect,
      delete: mockDelete,
      insert: mockInsert,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      range: mockRange,
      limit: mockLimit,
    });

    mockEq.mockReturnValue({
      order: mockOrder,
      range: mockRange,
      limit: mockLimit,
      eq: mockEq,
    });

    mockOrder.mockReturnValue({
      range: mockRange,
      limit: mockLimit,
    });

    mockRange.mockResolvedValue({ data: [], error: null });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockInsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) });
  });

  it('returns empty years when no data', async () => {
    const { useSupabaseTransactions } = await import(`../../src/hooks/useSupabaseTransactions?test=${Date.now()}`);
    const { result } = renderHook(() => useSupabaseTransactions());
    const years = await result.current.getAvailableYears();
    expect(years.length).toBe(0);
  });

  it('handles upload with empty list', async () => {
    const { useSupabaseTransactions } = await import(`../../src/hooks/useSupabaseTransactions?test=${Date.now()}`);
    const { result } = renderHook(() => useSupabaseTransactions());
    const response = await result.current.uploadTransactions([], 2024);
    expect(response.success).toBe(false);
  });
});
