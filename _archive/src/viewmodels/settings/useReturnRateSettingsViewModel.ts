import { useSettings } from '@/contexts/SettingsContext';
import { clampReturnRate } from '@/domain/settings/returnRate';

export function useReturnRateSettingsViewModel() {
  const { settings, updateMinReturnRate, updateMaxReturnRate } = useSettings();

  const handleMinChange = (value: number) => {
    updateMinReturnRate(clampReturnRate(value, 0, 10));
  };

  const handleMaxChange = (value: number) => {
    updateMaxReturnRate(clampReturnRate(value, 0, 15));
  };

  return {
    minReturnRate: settings.minReturnRate,
    maxReturnRate: settings.maxReturnRate,
    handleMinChange,
    handleMaxChange,
  };
}
