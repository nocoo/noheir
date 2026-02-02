import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockClearState = () => ({ data: [], error: null });

let currentUser: { id: string } | null = { id: 'user-1' };

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('useTransfers', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockOrder.mockReset();
    mockDelete.mockReset();
    mockEq.mockReset();
    mockInsert.mockReset();

    mockFrom.mockReturnValue({
      select: mockSelect,
      delete: mockDelete,
      insert: mockInsert,
    });
    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
    });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null, data: [] });
    mockInsert.mockResolvedValue({ error: null });
  });

  it('parses transfer CSV and filters records', async () => {
    const { useTransfers } = await import(`../../src/hooks/useTransfers?test=${Date.now()}`);
    const { result } = renderHook(() => useTransfers());
    const csv = '日期,收支大类,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注\n' +
      '2024-01-01,转账,转账,转账,100,0,人民币,账户A → 账户B,,\n' +
      '2024-01-02,转账,转账,转账 / 优惠抵扣,100,0,人民币,账户A → 账户B,,\n';

    const parsed = result.current.parseTransferCSV(csv);
    expect(parsed.length).toBe(1);
    expect(parsed[0].fromAccount).toBe('账户A');
  });

  it('exports transfers CSV', async () => {
    currentUser = null;
    mockOrder.mockResolvedValue({
      data: [{
        id: 't1',
        user_id: 'user-1',
        date: '2024-01-01',
        year: 2024,
        month: 1,
        day: 1,
        primary_category: '转账',
        secondary_category: '转账',
        transaction_type: '转账',
        inflow_amount: 100,
        outflow_amount: 0,
        currency: '人民币',
        account: '账户A → 账户B',
        tags: [],
        note: null,
        raw_index: null,
        created_at: '2024-01-01T00:00:00Z',
      }],
      error: null,
    });

    const { useTransfers } = await import(`../../src/hooks/useTransfers?test=${Date.now()}`);
    const { result } = renderHook(() => useTransfers());
    const csv = result.current.exportTransfers();
    expect(csv.includes('日期,收支大类')).toBe(true);
  });

  it('loads transfers', async () => {
    currentUser = { id: 'user-1' };
    const { useTransfers } = await import(`../../src/hooks/useTransfers?test=${Date.now()}`);
    const { result } = renderHook(() => useTransfers());
    await act(async () => {
      await result.current.loadTransfers();
    });
    expect(mockOrder).toHaveBeenCalled();
  });
});
