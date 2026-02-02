import { useMemo } from 'react';
import { useUnitsDisplay } from '@/hooks/useAssets';
import { buildMonthlyMaturities, buildSeries, buildSummaryStats } from '@/domain/assets/liquidityLadder';

export function useLiquidityLadderViewModel() {
  const { data: units } = useUnitsDisplay();

  const monthlyData = useMemo(() => buildMonthlyMaturities(units || []), [units]);
  const series = useMemo(() => buildSeries(monthlyData), [monthlyData]);
  const summary = useMemo(() => buildSummaryStats(monthlyData), [monthlyData]);

  return {
    units,
    monthlyData,
    series,
    summary,
    currencySymbol: '¥',
  };
}
