import { describe, expect, it } from 'bun:test';
import {
  buildCurrencyDistribution,
  buildDeploymentRate,
  buildIdleUnits,
  buildIncomingLiquidity,
  buildMaturityDistribution,
  buildStatusDistribution,
  buildTotalAssetsAll,
  buildTotalAssetsByCurrency,
} from '../../src/domain/assets/capitalDashboard';

describe('capitalDashboard domain', () => {
  it('calculates totals by currency and total assets', () => {
    const totals = buildTotalAssetsByCurrency([
      { status: '已成立', currency: 'CNY', amount: 100 },
      { status: '已成立', currency: 'USD', amount: 50 },
    ]);
    expect(totals.CNY).toBe(100);
    expect(buildTotalAssetsAll(totals)).toBe(150);
  });

  it('builds deployment rate', () => {
    expect(buildDeploymentRate({ total_assets: 100, invested_amount: 20, upcoming_maturities: [] })).toBe(20);
  });

  it('builds idle units', () => {
    const idle = buildIdleUnits([
      { status: '已成立', currency: 'CNY', amount: 10 },
      { status: '已成立', currency: 'CNY', amount: 10, product: {} },
    ]);
    expect(idle.length).toBe(1);
  });

  it('builds incoming liquidity', () => {
    const incoming = buildIncomingLiquidity({
      total_assets: 0,
      invested_amount: 0,
      upcoming_maturities: [{ amount: 10 }, { amount: 20 }],
    });
    expect(incoming.total).toBe(30);
    expect(incoming.count).toBe(2);
  });

  it('builds distributions', () => {
    const units = [
      { status: '已成立', currency: 'CNY', amount: 100 },
      { status: '已成立', currency: 'CNY', amount: 50 },
    ];
    const currency = buildCurrencyDistribution(units, 150);
    expect(currency[0].percentage).toBeCloseTo(100);

    const status = buildStatusDistribution(units, 150);
    expect(status[0].amount).toBe(150);

    const maturity = buildMaturityDistribution([
      { status: '已成立', currency: 'CNY', amount: 100, end_date: '2024-01-10', is_available: true },
    ], 100);
    expect(maturity[0].period).toBe('已到期');
  });
});
