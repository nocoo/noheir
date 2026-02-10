import { describe, it, expect, beforeEach, mock, vi } from 'bun:test';
import type {
  AssetExportData,
  ExportedProduct,
  ExportedUnit,
} from '../../src/services/assetService';

// ---------------------------------------------------------------------------
// Supabase mocks (same pattern as assetService.test.ts)
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
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

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<ExportedProduct> = {}): ExportedProduct {
  return {
    name: '测试产品',
    channel: '招商银行',
    category: '定期存款',
    currency: 'CNY',
    lock_period_days: 90,
    ...overrides,
  };
}

function makeUnit(overrides: Partial<ExportedUnit> = {}): ExportedUnit {
  return {
    unit_code: 'E01',
    amount: 50000,
    currency: 'CNY',
    status: '已成立',
    strategy: '短期理财',
    tactics: '理财产品',
    ...overrides,
  };
}

function makeExportData(
  products: ExportedProduct[] = [makeProduct()],
  units: ExportedUnit[] = [makeUnit()],
): AssetExportData {
  return {
    version: 1,
    exported_at: '2026-02-10T00:00:00.000Z',
    products,
    units,
  };
}

// ===========================================================================
// parseAssetJSON tests
// ===========================================================================

describe('parseAssetJSON', () => {
  it('parses valid export data', async () => {
    const { parseAssetJSON } = await setup();
    const json = JSON.stringify(makeExportData());
    const { data, warnings } = parseAssetJSON(json);

    expect(data.version).toBe(1);
    expect(data.products).toHaveLength(1);
    expect(data.units).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it('throws on invalid JSON', async () => {
    const { parseAssetJSON } = await setup();
    expect(() => parseAssetJSON('{')).toThrow('Invalid JSON');
  });

  it('throws on non-object JSON', async () => {
    const { parseAssetJSON } = await setup();
    expect(() => parseAssetJSON('"hello"')).toThrow('must be an object');
  });

  it('throws on unsupported version', async () => {
    const { parseAssetJSON } = await setup();
    const json = JSON.stringify({ version: 2, products: [], units: [] });
    expect(() => parseAssetJSON(json)).toThrow('Unsupported export version');
  });

  it('throws when products is not an array', async () => {
    const { parseAssetJSON } = await setup();
    const json = JSON.stringify({ version: 1, products: 'bad', units: [] });
    expect(() => parseAssetJSON(json)).toThrow('Missing or invalid "products"');
  });

  it('throws when units is not an array', async () => {
    const { parseAssetJSON } = await setup();
    const json = JSON.stringify({ version: 1, products: [], units: null });
    expect(() => parseAssetJSON(json)).toThrow('Missing or invalid "units"');
  });

  it('accepts empty arrays', async () => {
    const { parseAssetJSON } = await setup();
    const json = JSON.stringify(makeExportData([], []));
    const { data } = parseAssetJSON(json);

    expect(data.products).toHaveLength(0);
    expect(data.units).toHaveLength(0);
  });

  it('warns on duplicate product names', async () => {
    const { parseAssetJSON } = await setup();
    const p = makeProduct();
    const json = JSON.stringify(makeExportData([p, p], []));
    const { warnings } = parseAssetJSON(json);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('duplicate product name');
  });
});

// ===========================================================================
// validateProduct tests
// ===========================================================================

describe('validateProduct', () => {
  it('returns no errors for a valid product', async () => {
    const { validateProduct } = await setup();
    const errors = validateProduct(makeProduct(), 0);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-object', async () => {
    const { validateProduct } = await setup();
    expect(validateProduct(null, 0)).toEqual(['products[0]: not an object']);
    expect(validateProduct('string', 1)).toEqual(['products[1]: not an object']);
  });

  it('requires name', async () => {
    const { validateProduct } = await setup();
    const errors = validateProduct({ ...makeProduct(), name: '' }, 0);
    expect(errors.some((e: string) => e.includes("'name'"))).toBe(true);
  });

  it('validates channel', async () => {
    const { validateProduct } = await setup();
    const errors = validateProduct({ ...makeProduct(), channel: 'invalid' }, 0);
    expect(errors.some((e: string) => e.includes("'channel'"))).toBe(true);
  });

  it('validates category', async () => {
    const { validateProduct } = await setup();
    const errors = validateProduct({ ...makeProduct(), category: 'invalid' }, 0);
    expect(errors.some((e: string) => e.includes("'category'"))).toBe(true);
  });

  it('validates currency when provided', async () => {
    const { validateProduct } = await setup();
    // valid currency should pass
    expect(validateProduct(makeProduct({ currency: 'USD' }), 0)).toHaveLength(0);
    // invalid currency should fail
    const errors = validateProduct({ ...makeProduct(), currency: 'EUR' }, 0);
    expect(errors.some((e: string) => e.includes("'currency'"))).toBe(true);
  });

  it('allows missing currency (defaults will apply)', async () => {
    const { validateProduct } = await setup();
    const p = makeProduct();
    delete (p as unknown as Record<string, unknown>).currency;
    expect(validateProduct(p, 0)).toHaveLength(0);
  });

  it('validates lock_period_days is non-negative', async () => {
    const { validateProduct } = await setup();
    const errors = validateProduct({ ...makeProduct(), lock_period_days: -1 }, 0);
    expect(errors.some((e: string) => e.includes('lock_period_days'))).toBe(true);
  });

  it('validates annual_return_rate is a number', async () => {
    const { validateProduct } = await setup();
    const errors = validateProduct({ ...makeProduct(), annual_return_rate: 'high' }, 0);
    expect(errors.some((e: string) => e.includes('annual_return_rate'))).toBe(true);
  });

  it('accepts valid annual_return_rate', async () => {
    const { validateProduct } = await setup();
    expect(validateProduct(makeProduct({ annual_return_rate: 3.5 }), 0)).toHaveLength(0);
  });

  it('accepts product with optional code', async () => {
    const { validateProduct } = await setup();
    expect(validateProduct(makeProduct({ code: 'PROD-001' }), 0)).toHaveLength(0);
  });

  it('collects multiple errors at once', async () => {
    const { validateProduct } = await setup();
    const errors = validateProduct({ channel: 'bad', category: 'bad' }, 0);
    expect(errors.length).toBeGreaterThanOrEqual(3); // name, channel, category
  });
});

// ===========================================================================
// validateUnit tests
// ===========================================================================

describe('validateUnit', () => {
  const productNames = new Set(['测试产品']);

  it('returns no errors for a valid unit', async () => {
    const { validateUnit } = await setup();
    expect(validateUnit(makeUnit(), 0, productNames)).toHaveLength(0);
  });

  it('rejects non-object', async () => {
    const { validateUnit } = await setup();
    expect(validateUnit(42, 0, productNames)).toEqual(['units[0]: not an object']);
  });

  it('requires unit_code', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit({ ...makeUnit(), unit_code: '' }, 0, productNames);
    expect(errors.some((e: string) => e.includes("'unit_code'"))).toBe(true);
  });

  it('requires positive amount', async () => {
    const { validateUnit } = await setup();
    expect(validateUnit({ ...makeUnit(), amount: 0 }, 0, productNames).some(
      (e: string) => e.includes("'amount'")
    )).toBe(true);
    expect(validateUnit({ ...makeUnit(), amount: -100 }, 0, productNames).some(
      (e: string) => e.includes("'amount'")
    )).toBe(true);
  });

  it('validates currency', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit({ ...makeUnit(), currency: 'GBP' }, 0, productNames);
    expect(errors.some((e: string) => e.includes("'currency'"))).toBe(true);
  });

  it('validates status', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit({ ...makeUnit(), status: 'invalid' }, 0, productNames);
    expect(errors.some((e: string) => e.includes("'status'"))).toBe(true);
  });

  it('validates strategy', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit({ ...makeUnit(), strategy: 'invalid' }, 0, productNames);
    expect(errors.some((e: string) => e.includes("'strategy'"))).toBe(true);
  });

  it('validates tactics', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit({ ...makeUnit(), tactics: 'invalid' }, 0, productNames);
    expect(errors.some((e: string) => e.includes("'tactics'"))).toBe(true);
  });

  it('validates product_name exists in products set', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit(
      makeUnit({ product_name: '不存在的产品' }),
      0,
      productNames
    );
    expect(errors.some((e: string) => e.includes('not found in products'))).toBe(true);
  });

  it('accepts valid product_name', async () => {
    const { validateUnit } = await setup();
    expect(validateUnit(makeUnit({ product_name: '测试产品' }), 0, productNames)).toHaveLength(0);
  });

  it('allows missing product_name (idle unit)', async () => {
    const { validateUnit } = await setup();
    expect(validateUnit(makeUnit(), 0, productNames)).toHaveLength(0);
  });

  it('validates start_date format', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit(
      makeUnit({ start_date: '2026/01/01' }),
      0,
      productNames
    );
    expect(errors.some((e: string) => e.includes("'start_date'"))).toBe(true);
  });

  it('accepts valid start_date', async () => {
    const { validateUnit } = await setup();
    expect(validateUnit(makeUnit({ start_date: '2026-01-01' }), 0, productNames)).toHaveLength(0);
  });

  it('accepts all valid strategies', async () => {
    const { validateUnit } = await setup();
    const strategies = [
      '远期理财', '美元资产', '36存单', '长期理财', '短期理财', '中期理财', '进攻计划', '麻麻理财',
    ];
    for (const strategy of strategies) {
      expect(validateUnit(makeUnit({ strategy }), 0, productNames)).toHaveLength(0);
    }
  });

  it('accepts all valid tactics', async () => {
    const { validateUnit } = await setup();
    const tactics = [
      '养老年金', '个人养老金', '定期存款', '理财产品', '现金产品',
      '债券基金', '偏股基金', '稳健理财', '增额寿险', '货币基金',
    ];
    for (const t of tactics) {
      expect(validateUnit(makeUnit({ tactics: t }), 0, productNames)).toHaveLength(0);
    }
  });

  it('accepts all valid statuses', async () => {
    const { validateUnit } = await setup();
    for (const status of ['已成立', '计划中', '筹集中', '已归档']) {
      expect(validateUnit(makeUnit({ status }), 0, productNames)).toHaveLength(0);
    }
  });

  it('collects multiple errors at once', async () => {
    const { validateUnit } = await setup();
    const errors = validateUnit(
      { unit_code: '', amount: -1, strategy: 'bad', tactics: 'bad' },
      0,
      productNames
    );
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ===========================================================================
// exportAssets tests
// ===========================================================================

describe('exportAssets', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockOrder.mockReset();
    mockRpc.mockReset();
  });

  it('exports products and units, stripping system fields', async () => {
    // Mock products query chain
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'p-1',
          user_id: 'u-1',
          name: '测试产品',
          code: 'PROD-001',
          channel: '招商银行',
          category: '定期存款',
          currency: 'CNY',
          lock_period_days: 90,
          annual_return_rate: 3.5,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });

    // Mock units RPC
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'unit-1',
          user_id: 'u-1',
          unit_code: 'E01',
          amount: 50000,
          currency: 'CNY',
          status: '已成立',
          strategy: '短期理财',
          tactics: '理财产品',
          product_id: 'p-1',
          start_date: '2026-01-15',
          note: 'test note',
          created_at: '2026-01-01T00:00:00Z',
          product: null,
        },
      ],
      error: null,
    });

    const { exportAssets } = await setup();
    const result = await exportAssets();

    // Check envelope
    expect(result.version).toBe(1);
    expect(result.exported_at).toBeDefined();

    // Check products — no id, user_id, created_at
    expect(result.products).toHaveLength(1);
    const p = result.products[0];
    expect(p.name).toBe('测试产品');
    expect(p.code).toBe('PROD-001');
    expect(p.channel).toBe('招商银行');
    expect(p.currency).toBe('CNY');
    expect(p.lock_period_days).toBe(90);
    expect(p.annual_return_rate).toBe(3.5);
    expect((p as Record<string, unknown>).id).toBeUndefined();
    expect((p as Record<string, unknown>).user_id).toBeUndefined();
    expect((p as Record<string, unknown>).created_at).toBeUndefined();

    // Check units — no id, user_id, created_at, product_id replaced with product_name
    expect(result.units).toHaveLength(1);
    const u = result.units[0];
    expect(u.unit_code).toBe('E01');
    expect(u.amount).toBe(50000);
    expect(u.product_name).toBe('测试产品');
    expect(u.start_date).toBe('2026-01-15');
    expect(u.note).toBe('test note');
    expect((u as Record<string, unknown>).id).toBeUndefined();
    expect((u as Record<string, unknown>).user_id).toBeUndefined();
    expect((u as Record<string, unknown>).product_id).toBeUndefined();
  });

  it('omits optional fields when null/undefined', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'p-1', user_id: 'u-1', name: '产品',
          channel: '支付宝', category: '货币基金', currency: 'CNY',
          lock_period_days: 0, annual_return_rate: null,
          code: null, created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });

    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'unit-1', user_id: 'u-1', unit_code: 'E01', amount: 10000,
          currency: 'CNY', status: '已成立', strategy: '短期理财', tactics: '货币基金',
          product_id: null, start_date: null, note: null,
          created_at: '2026-01-01T00:00:00Z', product: null,
        },
      ],
      error: null,
    });

    const { exportAssets } = await setup();
    const result = await exportAssets();

    const p = result.products[0];
    expect(p.code).toBeUndefined();
    expect(p.annual_return_rate).toBeUndefined();

    const u = result.units[0];
    expect(u.product_name).toBeUndefined();
    expect(u.start_date).toBeUndefined();
    expect(u.note).toBeUndefined();
  });

  it('handles empty database', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { exportAssets } = await setup();
    const result = await exportAssets();

    expect(result.products).toHaveLength(0);
    expect(result.units).toHaveLength(0);
  });

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const { exportAssets } = await setup();
    await expect(exportAssets()).rejects.toThrow('DB error');
  });
});

// ===========================================================================
// importAssets tests
// ===========================================================================

describe('importAssets', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockRpc.mockReset();
  });

  it('imports products and units, resolving product_name to product_id', async () => {
    const insertedProducts = [
      { id: 'new-p-1', name: '测试产品', channel: '招商银行', category: '定期存款', currency: 'CNY', lock_period_days: 90 },
    ];
    const insertedUnits = [
      { id: 'new-u-1', unit_code: 'E01', amount: 50000 },
    ];

    // products insert chain
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      return {
        insert: (records: unknown[]) => {
          mockInsert(records);
          return {
            select: () => {
              callCount++;
              if (table === 'financial_products') {
                return Promise.resolve({ data: insertedProducts, error: null });
              }
              return Promise.resolve({ data: insertedUnits, error: null });
            },
          };
        },
      };
    });

    const { importAssets } = await setup();
    const result = await importAssets(makeExportData(
      [makeProduct()],
      [makeUnit({ product_name: '测试产品' })],
    ));

    expect(result.products_created).toBe(1);
    expect(result.units_created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when unit references unknown product', async () => {
    // Product insert returns product with different name than what unit references
    mockFrom.mockImplementation((table: string) => ({
      insert: () => ({
        select: () => {
          if (table === 'financial_products') {
            return Promise.resolve({ data: [{ id: 'p-1', name: '产品A' }], error: null });
          }
          return Promise.resolve({ data: [{ id: 'u-1' }], error: null });
        },
      }),
    }));

    const { importAssets } = await setup();
    const result = await importAssets(makeExportData(
      [makeProduct({ name: '产品A' })],
      [makeUnit({ product_name: '产品B' })], // doesn't match
    ));

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain('产品B');
    expect(result.warnings[0]).toContain('not found');
  });

  it('handles product insert error gracefully', async () => {
    mockFrom.mockImplementation(() => ({
      insert: () => ({
        select: () => Promise.resolve({ data: null, error: { message: 'duplicate key' } }),
      }),
    }));

    const { importAssets } = await setup();
    const result = await importAssets(makeExportData([makeProduct()], []));

    expect(result.products_created).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('duplicate key');
  });

  it('handles unit insert error gracefully', async () => {
    mockFrom.mockImplementation((table: string) => ({
      insert: () => ({
        select: () => {
          if (table === 'financial_products') {
            return Promise.resolve({ data: [{ id: 'p-1', name: '测试产品' }], error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'insert failed' } });
        },
      }),
    }));

    const { importAssets } = await setup();
    const result = await importAssets(makeExportData());

    expect(result.units_created).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('insert failed');
  });

  it('imports with empty products and units', async () => {
    const { importAssets } = await setup();
    const result = await importAssets(makeExportData([], []));

    expect(result.products_created).toBe(0);
    expect(result.units_created).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('applies default values for optional fields', async () => {
    let capturedRecords: Record<string, unknown>[] = [];
    mockFrom.mockImplementation((table: string) => ({
      insert: (records: Record<string, unknown>[]) => {
        if (table === 'financial_products') {
          capturedRecords = records;
        }
        return {
          select: () => {
            if (table === 'financial_products') {
              return Promise.resolve({
                data: records.map((r, i) => ({ ...r, id: `p-${i}` })),
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    }));

    const { importAssets } = await setup();
    const product = makeProduct();
    delete (product as unknown as Record<string, unknown>).currency;
    (product as unknown as Record<string, unknown>).lock_period_days = undefined;

    await importAssets(makeExportData([product], []));

    expect(capturedRecords[0].currency).toBe('CNY');
    expect(capturedRecords[0].lock_period_days).toBe(0);
  });

  it('applies default values for unit optional fields', async () => {
    let capturedUnitRecords: Record<string, unknown>[] = [];
    mockFrom.mockImplementation((table: string) => ({
      insert: (records: Record<string, unknown>[]) => {
        if (table === 'capital_units') {
          capturedUnitRecords = records;
        }
        return {
          select: () => Promise.resolve({
            data: records.map((r, i) => ({ ...r, id: `id-${i}` })),
            error: null,
          }),
        };
      },
    }));

    const { importAssets } = await setup();
    const unit = makeUnit();
    delete (unit as unknown as Record<string, unknown>).currency;
    delete (unit as unknown as Record<string, unknown>).status;

    await importAssets(makeExportData([], [unit]));

    expect(capturedUnitRecords[0].currency).toBe('CNY');
    expect(capturedUnitRecords[0].status).toBe('已成立');
  });
});

// ===========================================================================
// Round-trip test: export → parse → import
// ===========================================================================

describe('round-trip: export → parse', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockOrder.mockReset();
    mockRpc.mockReset();
  });

  it('exported JSON can be parsed back without errors', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'p-1', user_id: 'u-1', name: '产品A', code: null,
          channel: '招商银行', category: '定期存款', currency: 'CNY',
          lock_period_days: 90, annual_return_rate: 3.5,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'p-2', user_id: 'u-1', name: '产品B', code: 'PROD-B',
          channel: '支付宝', category: '货币基金', currency: 'USD',
          lock_period_days: 0, annual_return_rate: null,
          created_at: '2026-01-02T00:00:00Z',
        },
      ],
      error: null,
    });

    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'unit-1', user_id: 'u-1', unit_code: 'E01', amount: 50000,
          currency: 'CNY', status: '已成立', strategy: '短期理财', tactics: '理财产品',
          product_id: 'p-1', start_date: '2026-01-15', note: null,
          created_at: '2026-01-01T00:00:00Z', product: null,
        },
        {
          id: 'unit-2', user_id: 'u-1', unit_code: 'E02', amount: 100000,
          currency: 'USD', status: '计划中', strategy: '美元资产', tactics: '稳健理财',
          product_id: null, start_date: null, note: 'idle unit',
          created_at: '2026-01-02T00:00:00Z', product: null,
        },
      ],
      error: null,
    });

    const { exportAssets, parseAssetJSON } = await setup();

    const exportData = await exportAssets();
    const json = JSON.stringify(exportData);
    const { data, warnings } = parseAssetJSON(json);

    expect(data.products).toHaveLength(2);
    expect(data.units).toHaveLength(2);
    expect(warnings).toHaveLength(0);

    // Verify product data integrity
    expect(data.products[0].name).toBe('产品A');
    expect(data.products[1].name).toBe('产品B');

    // Verify unit data integrity
    expect(data.units[0].product_name).toBe('产品A');
    expect(data.units[1].product_name).toBeUndefined();
  });
});
