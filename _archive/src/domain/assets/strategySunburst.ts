import { getLabelColorHex } from '@/lib/tagColors';
import type { UnitDisplayInfo } from '@/types/assets';

export type SunburstData = {
  name: string;
  value?: number;
  children?: SunburstData[];
  itemStyle?: { color?: string };
};

export const buildStrategyHierarchy = (units: UnitDisplayInfo[], rootName: string): SunburstData => {
  if (!units || units.length === 0) {
    return { name: rootName, children: [] };
  }

  const establishedUnits = units.filter(unit => unit.status === '已成立');
  const hierarchy: Record<string, Record<string, Record<string, number>>> = {};

  establishedUnits.forEach(unit => {
    const currency = unit.currency;
    const strategy = unit.strategy;
    const product = unit.product?.name || '未分配';

    hierarchy[currency] ||= {};
    hierarchy[currency][strategy] ||= {};
    hierarchy[currency][strategy][product] ||= 0;
    hierarchy[currency][strategy][product] += unit.amount;
  });

  const currencyNames: Record<string, string> = {
    CNY: '人民币',
    USD: '美元',
    HKD: '港币',
  };

  const children = Object.entries(hierarchy)
    .map(([currency, strategies]) => ({
      name: currencyNames[currency] || currency,
      children: Object.entries(strategies)
        .map(([strategy, products]) => ({
          name: strategy,
          children: Object.entries(products)
            .map(([product, amount]) => ({
              name: product,
              value: amount,
              itemStyle: { color: getLabelColorHex(product) },
            }))
            .sort((a, b) => (b.value || 0) - (a.value || 0)),
        }))
        .sort((a, b) => {
          const totalA = (a.children || []).reduce((sum, p) => sum + (p.value || 0), 0);
          const totalB = (b.children || []).reduce((sum, p) => sum + (p.value || 0), 0);
          return totalB - totalA;
        }),
    }))
    .sort((a, b) => {
      const totalA = (a.children || []).reduce((sum, s) =>
        sum + (s.children || []).reduce((sum2, p) => sum2 + (p.value || 0), 0), 0);
      const totalB = (b.children || []).reduce((sum, s) =>
        sum + (s.children || []).reduce((sum2, p) => sum2 + (p.value || 0), 0), 0);
      return totalB - totalA;
    });

  return { name: rootName, children };
};

export const buildTotalAmount = (units: UnitDisplayInfo[]) => {
  if (!units) return 0;
  return units.filter(u => u.status === '已成立').reduce((sum, u) => sum + u.amount, 0);
};
