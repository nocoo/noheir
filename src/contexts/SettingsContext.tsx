import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'default' | 'swapped';

interface Settings {
  theme: Theme;
  colorScheme: ColorScheme;
  targetSavingsRate: number;
  activeIncomeCategories: string[];
  siteName: string;
  minReturnRate: number;      // 保底收益率 (%)
  maxReturnRate: number;      // 风险收益率阈值 (%)
}

interface SettingsContextType {
  settings: Settings;
  updateTheme: (theme: Theme) => void;
  updateColorScheme: (scheme: ColorScheme) => void;
  updateTargetSavingsRate: (rate: number) => void;
  updateActiveIncomeCategories: (categories: string[]) => void;
  toggleActiveIncomeCategory: (category: string) => void;
  isCategoryActiveIncome: (category: string) => boolean;
  updateSiteName: (name: string) => void;
  updateMinReturnRate: (rate: number) => void;
  updateMaxReturnRate: (rate: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  colorScheme: 'default',
  targetSavingsRate: 60,
  activeIncomeCategories: [],
  siteName: '个人财务管理',
  minReturnRate: 1.25,
  maxReturnRate: 4.0,
};

const STORAGE_KEY = 'finance-settings';

// Load settings from localStorage
const loadFromLocalStorage = (): Settings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with DEFAULT_SETTINGS to ensure all fields exist
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err);
  }
  return DEFAULT_SETTINGS;
};

// Save settings to localStorage
const saveToLocalStorage = (settings: Settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage first for instant load
  const [settings, setSettings] = useState<Settings>(() => loadFromLocalStorage());

  // Track if we've already synced from Supabase (only sync once per session)
  const hasSyncedFromSupabase = useRef(false);

  // Sync siteName and other settings from Supabase when user logs in
  useEffect(() => {
    if (hasSyncedFromSupabase.current) return;

    const syncFromSupabase = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: settingsData, error } = await supabase
        .from('settings')
        .select('*')
        .eq('owner_id', session.user.id)
        .maybeSingle();

      if (!error && settingsData) {
        hasSyncedFromSupabase.current = true;

        // Sync site_name
        if (settingsData.site_name) {
          setSettings(prev => ({ ...prev, siteName: settingsData.site_name }));
        }

        // Sync other settings
        if (settingsData.settings) {
          setSettings(prev => ({
            ...prev,
            ...(settingsData.settings.targetSavingsRate !== undefined && { targetSavingsRate: settingsData.settings.targetSavingsRate }),
            ...(settingsData.settings.activeIncomeCategories && { activeIncomeCategories: settingsData.settings.activeIncomeCategories }),
          }));
        }
      }
    };

    syncFromSupabase();
  }, []);

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveToLocalStorage(settings);
  }, [settings]);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let effectiveTheme: 'light' | 'dark' = 'light';
    if (settings.theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effectiveTheme = settings.theme;
    }

    root.classList.add(effectiveTheme);
  }, [settings.theme]);

  // Update document title based on siteName
  useEffect(() => {
    if (settings.siteName) {
      document.title = settings.siteName;
    }
  }, [settings.siteName]);

  const updateTheme = (theme: Theme) => {
    setSettings(prev => ({ ...prev, theme }));
  };

  const updateColorScheme = (colorScheme: ColorScheme) => {
    setSettings(prev => ({ ...prev, colorScheme }));
  };

  const updateTargetSavingsRate = (rate: number) => {
    setSettings(prev => ({ ...prev, targetSavingsRate: rate }));
  };

  const updateActiveIncomeCategories = (categories: string[]) => {
    setSettings(prev => ({ ...prev, activeIncomeCategories: categories }));
  };

  const toggleActiveIncomeCategory = (category: string) => {
    setSettings(prev => {
      const isActive = prev.activeIncomeCategories.includes(category);
      const newCategories = isActive
        ? prev.activeIncomeCategories.filter(c => c !== category)
        : [...prev.activeIncomeCategories, category];
      return { ...prev, activeIncomeCategories: newCategories };
    });
  };

  const isCategoryActiveIncome = (category: string) => {
    return settings.activeIncomeCategories.includes(category);
  };

  const updateSiteName = (name: string) => {
    setSettings(prev => ({ ...prev, siteName: name }));
  };

  const updateMinReturnRate = (rate: number) => {
    setSettings(prev => ({ ...prev, minReturnRate: rate }));
  };

  const updateMaxReturnRate = (rate: number) => {
    setSettings(prev => ({ ...prev, maxReturnRate: rate }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateTheme,
        updateColorScheme,
        updateTargetSavingsRate,
        updateActiveIncomeCategories,
        toggleActiveIncomeCategory,
        isCategoryActiveIncome,
        updateSiteName,
        updateMinReturnRate,
        updateMaxReturnRate,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Helper to get colors based on scheme using semantic CSS variables
export function getIncomeColor(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'text-expense' : 'text-income';
}

export function getExpenseColor(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'text-income' : 'text-expense';
}

// HSL format for CSS/style attributes
export function getIncomeColorHsl(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'hsl(var(--expense))' : 'hsl(var(--income))';
}

export function getExpenseColorHsl(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'hsl(var(--income))' : 'hsl(var(--expense))';
}

// Hex format for ECharts and other libraries that require hex values
export function getIncomeColorHex(scheme: ColorScheme): string {
  return scheme === 'swapped' ? '#e11d48' : '#059669';
}

export function getExpenseColorHex(scheme: ColorScheme): string {
  return scheme === 'swapped' ? '#059669' : '#e11d48';
}

// Return rate status based on settings
export type ReturnRateStatus = 'low' | 'normal' | 'high';

export function getReturnRateStatus(rate: number, settings: Settings): ReturnRateStatus {
  if (rate < settings.minReturnRate) return 'low';
  if (rate > settings.maxReturnRate) return 'high';
  return 'normal';
}

export function getReturnRateColor(status: ReturnRateStatus): string {
  switch (status) {
    case 'low':
      return 'text-amber-600 dark:text-amber-400';      // 过低 - 黄色警告
    case 'high':
      return 'text-rose-600 dark:text-rose-400';        // 过高 - 红色风险
    case 'normal':
    default:
      return 'text-emerald-600 dark:text-emerald-400';  // 正常 - 绿色
  }
}

export function getReturnRateBgColor(status: ReturnRateStatus): string {
  switch (status) {
    case 'low':
      return 'bg-amber-50 dark:bg-amber-500/10';
    case 'high':
      return 'bg-rose-50 dark:bg-rose-500/10';
    case 'normal':
    default:
      return 'bg-emerald-50 dark:bg-emerald-500/10';
  }
}
