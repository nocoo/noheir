import { useEffect, useRef } from 'react';
import { useSiteMetadata } from '@/hooks/useSiteMetadata';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Component that syncs settings from Supabase to SettingsContext.
 * Only syncs targetSavingsRate and activeIncomeCategories, not theme/colorScheme.
 */
export function SettingsSync() {
  const { user } = useAuth();
  const { data, loading } = useSiteMetadata();
  const { updateTargetSavingsRate, updateActiveIncomeCategories } = useSettings();

  // Track if we've already synced the initial settings
  const hasInitialSynced = useRef(false);

  useEffect(() => {
    if (user && data?.settings && !loading && !hasInitialSynced.current) {
      // Only sync once on initial load
      hasInitialSynced.current = true;

      // Only sync data that needs to persist in database
      const { targetSavingsRate, activeIncomeCategories } = data.settings;

      if (targetSavingsRate !== undefined) {
        updateTargetSavingsRate(targetSavingsRate);
      }
      if (activeIncomeCategories) {
        updateActiveIncomeCategories(activeIncomeCategories);
      }
    }
  }, [user, data, loading, updateTargetSavingsRate, updateActiveIncomeCategories]);

  return null;
}
