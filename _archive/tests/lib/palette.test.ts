import { describe, it, expect } from 'bun:test';
import {
  chart,
  CHART_COLORS,
  CHART_TOKENS,
  withAlpha,
  chartIncome,
  chartExpense,
  chartBalance,
  chartPrimary,
  chartAxis,
  chartMuted,
  heatmap,
  resolveColor,
  resolveColors,
  resolveChartColors,
  resolveChartColor,
  STRATEGY_TOKEN_MAP,
  CURRENCY_TOKEN_MAP,
  STATUS_TOKEN_MAP,
  MATURITY_TOKEN_MAP,
  ACCOUNT_TYPE_TOKEN_MAP,
  resolveStrategyColor,
  resolveCurrencyColor,
  resolveStatusColor,
  resolveMaturityColor,
} from '../../src/lib/palette';

describe('palette', () => {
  describe('chart color map', () => {
    it('has 24 named colors', () => {
      expect(Object.keys(chart)).toHaveLength(24);
    });

    it('all values are hsl(var(--chart-N)) format', () => {
      Object.values(chart).forEach((color, i) => {
        expect(color).toBe(`hsl(var(--chart-${i + 1}))`);
      });
    });
  });

  describe('CHART_COLORS array', () => {
    it('has 24 entries matching chart object values', () => {
      expect(CHART_COLORS).toHaveLength(24);
      expect(CHART_COLORS).toEqual(Object.values(chart));
    });
  });

  describe('CHART_TOKENS', () => {
    it('has 24 tokens in chart-N format', () => {
      expect(CHART_TOKENS).toHaveLength(24);
      expect(CHART_TOKENS[0]).toBe('chart-1');
      expect(CHART_TOKENS[23]).toBe('chart-24');
    });
  });

  describe('withAlpha', () => {
    it('wraps token with alpha', () => {
      expect(withAlpha('chart-1', 0.5)).toBe('hsl(var(--chart-1) / 0.5)');
    });

    it('works with semantic tokens', () => {
      expect(withAlpha('income', 0.12)).toBe('hsl(var(--income) / 0.12)');
    });
  });

  describe('semantic aliases', () => {
    it('chartIncome references --income', () => {
      expect(chartIncome).toBe('hsl(var(--income))');
    });

    it('chartExpense references --expense', () => {
      expect(chartExpense).toBe('hsl(var(--expense))');
    });

    it('chartBalance is chart.teal', () => {
      expect(chartBalance).toBe(chart.teal);
    });

    it('chartPrimary is chart.sky', () => {
      expect(chartPrimary).toBe(chart.sky);
    });

    it('chartAxis references --chart-axis', () => {
      expect(chartAxis).toBe('hsl(var(--chart-axis))');
    });

    it('chartMuted references --chart-muted', () => {
      expect(chartMuted).toBe('hsl(var(--chart-muted))');
    });
  });

  describe('heatmap scales', () => {
    it('has 4 hues with 4 intensities each', () => {
      expect(Object.keys(heatmap)).toEqual(['green', 'red', 'blue', 'orange']);
      Object.values(heatmap).forEach((scale) => {
        expect(scale).toHaveLength(4);
      });
    });

    it('green scale uses correct tokens', () => {
      heatmap.green.forEach((color, i) => {
        expect(color).toBe(`hsl(var(--heatmap-green-${i + 1}))`);
      });
    });
  });

  describe('resolveColor (no DOM)', () => {
    it('returns fallback when document is not available', () => {
      // In test environment (bun:test), document is undefined
      const result = resolveColor('chart-1');
      expect(result).toBe('#888');
    });
  });

  describe('resolveColors (no DOM)', () => {
    it('returns fallback array', () => {
      const results = resolveColors(['chart-1', 'chart-2']);
      expect(results).toEqual(['#888', '#888']);
    });
  });

  describe('resolveChartColors (no DOM)', () => {
    it('returns 24 fallback colors', () => {
      const results = resolveChartColors();
      expect(results).toHaveLength(24);
      results.forEach((c) => expect(c).toBe('#888'));
    });
  });

  describe('resolveChartColor (no DOM)', () => {
    it('returns fallback for any index', () => {
      expect(resolveChartColor(0)).toBe('#888');
      expect(resolveChartColor(25)).toBe('#888'); // wraps around
    });
  });

  describe('domain token maps', () => {
    it('STRATEGY_TOKEN_MAP covers all 8 strategies', () => {
      expect(Object.keys(STRATEGY_TOKEN_MAP)).toHaveLength(8);
      Object.values(STRATEGY_TOKEN_MAP).forEach((token) => {
        expect(token).toMatch(/^chart-\d+$/);
      });
    });

    it('CURRENCY_TOKEN_MAP covers CNY, USD, HKD', () => {
      expect(Object.keys(CURRENCY_TOKEN_MAP)).toEqual(['CNY', 'USD', 'HKD']);
    });

    it('STATUS_TOKEN_MAP covers 4 statuses', () => {
      expect(Object.keys(STATUS_TOKEN_MAP)).toHaveLength(4);
    });

    it('MATURITY_TOKEN_MAP covers 5 periods', () => {
      expect(Object.keys(MATURITY_TOKEN_MAP)).toHaveLength(5);
    });

    it('ACCOUNT_TYPE_TOKEN_MAP covers 5 types', () => {
      expect(Object.keys(ACCOUNT_TYPE_TOKEN_MAP)).toEqual([
        'debit', 'credit', 'prepaid', 'financial', 'unclassified',
      ]);
    });
  });

  describe('domain resolver helpers (no DOM)', () => {
    it('resolveStrategyColor returns fallback for known strategy', () => {
      expect(resolveStrategyColor('远期理财')).toBe('#888');
    });

    it('resolveStrategyColor returns fallback for unknown strategy', () => {
      expect(resolveStrategyColor('不存在')).toBe('#888');
    });

    it('resolveCurrencyColor returns fallback', () => {
      expect(resolveCurrencyColor('CNY')).toBe('#888');
    });

    it('resolveStatusColor returns fallback', () => {
      expect(resolveStatusColor('已成立')).toBe('#888');
    });

    it('resolveMaturityColor returns fallback', () => {
      expect(resolveMaturityColor('已到期')).toBe('#888');
    });
  });
});
