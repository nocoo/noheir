import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PostgrestError } from '@supabase/supabase-js';
import type { Theme, ColorScheme } from '@/contexts/SettingsContext';

interface UserSettings {
  theme: Theme;
  colorScheme: ColorScheme;
  targetSavingsRate: number;
  activeIncomeCategories: string[];
}

interface SiteMetadata {
  id: number;
  owner_id: string;
  site_name: string;
  settings: UserSettings;
  created_at: string;
}

interface UseSiteMetadataReturn {
  data: SiteMetadata | null;
  loading: boolean;
  error: PostgrestError | null;
  createMetadata: (siteName: string, settings?: UserSettings) => Promise<SiteMetadata>;
  updateSiteName: (siteName: string) => Promise<SiteMetadata>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<SiteMetadata>;
  updateSingleSetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => Promise<SiteMetadata>;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  colorScheme: 'default',
  targetSavingsRate: 60,
  activeIncomeCategories: [],
};

export function useSiteMetadata(): UseSiteMetadataReturn {
  const { user } = useAuth();
  const [data, setData] = useState<SiteMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('site_metadata')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) {
        setError(error);
      } else {
        setData(data);
      }
      setLoading(false);
    };

    fetchMetadata();
  }, [user]);

  const createMetadata = async (
    siteName: string,
    settings: UserSettings = DEFAULT_SETTINGS
  ): Promise<SiteMetadata> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('site_metadata')
      .insert({
        owner_id: user.id,
        site_name: siteName,
        settings,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    setData(data);
    return data;
  };

  const updateSiteName = async (siteName: string): Promise<SiteMetadata> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('site_metadata')
      .update({ site_name: siteName })
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    setData(data);
    return data;
  };

  const updateSettings = async (
    settingsUpdate: Partial<UserSettings>
  ): Promise<SiteMetadata> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Merge with existing settings
    const currentSettings = data?.settings || DEFAULT_SETTINGS;
    const newSettings = { ...currentSettings, ...settingsUpdate };

    const { data: updatedData, error } = await supabase
      .from('site_metadata')
      .update({ settings: newSettings })
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    setData(updatedData);
    return updatedData;
  };

  const updateSingleSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ): Promise<SiteMetadata> => {
    return updateSettings({ [key]: value });
  };

  return {
    data,
    loading,
    error,
    createMetadata,
    updateSiteName,
    updateSettings,
    updateSingleSetting,
  };
}
