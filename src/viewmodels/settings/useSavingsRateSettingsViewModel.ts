import { useCallback, useRef } from 'react';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { clampSavingsRate, getSavingsRateTone } from '@/domain/settings/savingsRate';

export function useSavingsRateSettingsViewModel() {
  const { user } = useAuth();
  const { data, loading, updateSingleSetting } = useSupabaseSettings();
  const { settings, updateTargetSavingsRate } = useSettings();
  const rateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dbSettings = data?.settings;

  const debouncedUpdateRate = useCallback((value: number) => {
    if (rateTimeoutRef.current) {
      clearTimeout(rateTimeoutRef.current);
    }
    rateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateSingleSetting('targetSavingsRate', value);
      } catch (err) {
        console.error('Failed to update savings rate:', err);
      }
    }, 1000);
  }, [updateSingleSetting]);

  const handleRateChange = (value: number) => {
    const nextValue = clampSavingsRate(value);
    updateTargetSavingsRate(nextValue);
    debouncedUpdateRate(nextValue);
  };

  return {
    isVisible: Boolean(user && dbSettings),
    loading,
    targetSavingsRate: settings.targetSavingsRate,
    rateTone: getSavingsRateTone(settings.targetSavingsRate),
    handleRateChange,
  };
}
