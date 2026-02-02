import { describe, it, expect, beforeEach, mock, vi } from 'bun:test';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockMaybeSingle = vi.fn();
const mockIn = vi.fn();
const mockRpc = vi.fn();

const setup = async () => {
  mock.module('../../src/lib/supabase', () => ({
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  }));

  return await import(`../../src/services/assetService?test=${Date.now()}`);
};

describe('assetService', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockOrder.mockReset();
    mockEq.mockReset();
    mockInsert.mockReset();
    mockSingle.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockMaybeSingle.mockReset();
    mockIn.mockReset();
    mockRpc.mockReset();

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });

    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      in: mockIn,
    });

    mockOrder.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ select: mockSelect, maybeSingle: mockMaybeSingle, single: mockSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockUpdate.mockReturnValue({ eq: () => ({ select: () => ({ single: mockSingle }) }) });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockIn.mockReturnValue({ order: mockOrder });
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: { id: 'p-1' }, error: null });
  });

  it('fetches products and orders by created_at', async () => {
    const { fetchProducts } = await setup();
    await fetchProducts();

    expect(mockFrom).toHaveBeenCalledWith('financial_products');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('creates product with defaults', async () => {
    const { createProduct } = await setup();
    const result = await createProduct({
      name: 'Prod',
      channel: '招商银行',
      category: '定期存款',
    });

    expect(result.id).toBe('p-1');
    expect(mockInsert).toHaveBeenCalledWith({
      name: 'Prod',
      channel: '招商银行',
      category: '定期存款',
      currency: 'CNY',
      lock_period_days: 0,
    });
  });

  it('fetches units with products via rpc', async () => {
    const { fetchUnits } = await setup();
    const result = await fetchUnits(true);
    expect(mockRpc).toHaveBeenCalledWith('get_units_with_products');
    expect(result.length).toBe(0);
  });

  it('fetches filtered units with products', async () => {
    const { fetchUnitsFiltered } = await setup();
    await fetchUnitsFiltered({
      filters: { status: ['已成立'] },
      withProducts: true,
    });

    expect(mockFrom).toHaveBeenCalledWith('capital_units');
  });

  it('deploys unit with strategy and tactics', async () => {
    mockSelect.mockReturnValue({ eq: () => ({ single: mockSingle }) });
    mockSingle.mockResolvedValueOnce({ data: { status: '已成立' }, error: null });

    const { deployUnit } = await setup();
    await deployUnit('u-1', {
      product_id: 'p-1',
      start_date: '2024-01-01',
      strategy: '短期理财',
      tactics: '理财产品',
    });

    expect(mockUpdate).toHaveBeenCalled();
  });

  it('fetches capital overview and computes dashboard', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: 'u-1',
          user_id: 'user-1',
          unit_code: 'E01',
          amount: 100,
          currency: 'CNY',
          status: '已成立',
          strategy: '短期理财',
          tactics: '理财产品',
          product_id: null,
          start_date: null,
          note: null,
          created_at: '2024-01-01T00:00:00Z',
          product: null,
        },
      ],
      error: null,
    });

    const { fetchCapitalOverview } = await setup();
    const result = await fetchCapitalOverview();
    expect(result.dashboard.total_units).toBe(1);
    expect(result.dashboard.idle_amount).toBe(100);
  });
});
