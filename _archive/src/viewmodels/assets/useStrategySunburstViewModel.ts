import { useMemo } from 'react';
import { useUnitsDisplay } from '@/hooks/useAssets';
import { useSettings } from '@/contexts/SettingsContext';
import { buildStrategyHierarchy, buildTotalAmount } from '@/domain/assets/strategySunburst';

export function useStrategySunburstViewModel() {
  const { data: units } = useUnitsDisplay();
  const { settings } = useSettings();

  const chartData = useMemo(
    () => buildStrategyHierarchy(units || [], settings.siteName || '资产'),
    [units, settings.siteName]
  );

  const totalAmount = useMemo(() => buildTotalAmount(units || []), [units]);

  return { units, chartData, totalAmount };
}
