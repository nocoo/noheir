import { getLabelColorHex } from "@/lib/tag-colors";
import type { UnitDisplayInfo } from "../types";

export type SunburstData = {
  /** Globally unique node id for React reconciliation (path-based). */
  id: string;
  /** Display label shown in the arc + tooltip. */
  name: string;
  value?: number;
  children?: SunburstData[];
  itemStyle?: { color?: string };
};

export const buildStrategyHierarchy = (
  units: UnitDisplayInfo[],
  rootName: string,
): SunburstData => {
  if (!units || units.length === 0) {
    return { id: rootName, name: rootName, children: [] };
  }

  const establishedUnits = units.filter((unit) => unit.status === "已成立");
  const hierarchy: Record<string, Record<string, Record<string, number>>> = {};

  establishedUnits.forEach((unit) => {
    const currency = unit.currency;
    const strategy = unit.strategy;
    const product = unit.product?.name ?? "未分配";

    if (!hierarchy[currency]) hierarchy[currency] = {};
    const currencyLevel = hierarchy[currency];
    if (!currencyLevel[strategy]) currencyLevel[strategy] = {};
    const strategyLevel = currencyLevel[strategy];
    strategyLevel[product] = (strategyLevel[product] ?? 0) + unit.amount;
  });

  const currencyNames: Record<string, string> = {
    CNY: "人民币",
    USD: "美元",
    HKD: "港币",
  };

  const children = Object.entries(hierarchy)
    .map(([currency, strategies]) => {
      const currencyLabel = currencyNames[currency] ?? currency;
      return {
        id: currencyLabel,
        name: currencyLabel,
        children: Object.entries(strategies)
          .map(([strategy, products]) => ({
            // Same strategy name can appear under multiple currencies —
            // prefix with currency to keep the id unique for React keys.
            id: `${currencyLabel}/${strategy}`,
            name: strategy,
            children: Object.entries(products)
              .map(([product, amount]) => ({
                // Same product name can recur across strategies (e.g. 灵活宝
                // under two different strategies) — prefix the full path.
                id: `${currencyLabel}/${strategy}/${product}`,
                name: product,
                value: amount,
                itemStyle: { color: getLabelColorHex(product) },
              }))
              .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
          }))
          .sort((a, b) => {
            const totalA = (a.children ?? []).reduce((sum, p) => sum + (p.value ?? 0), 0);
            const totalB = (b.children ?? []).reduce((sum, p) => sum + (p.value ?? 0), 0);
            return totalB - totalA;
          }),
      };
    })
    .sort((a, b) => {
      const totalA = (a.children ?? []).reduce(
        (sum, s) => sum + (s.children ?? []).reduce((sum2, p) => sum2 + (p.value ?? 0), 0),
        0,
      );
      const totalB = (b.children ?? []).reduce(
        (sum, s) => sum + (s.children ?? []).reduce((sum2, p) => sum2 + (p.value ?? 0), 0),
        0,
      );
      return totalB - totalA;
    });

  return { id: rootName, name: rootName, children };
};

export const buildTotalAmount = (units: UnitDisplayInfo[]): number => {
  if (!units) return 0;
  return units.filter((u) => u.status === "已成立").reduce((sum, u) => sum + u.amount, 0);
};
