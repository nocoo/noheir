import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'default' | 'swapped';

interface Settings {
  theme: Theme;
  colorScheme: ColorScheme;
  targetSavingsRate: number;
  activeIncomeCategories: string[];
}

interface SettingsContextType {
  settings: Settings;
  updateTheme: (theme: Theme) => void;
  updateColorScheme: (scheme: ColorScheme) => void;
  updateTargetSavingsRate: (rate: number) => void;
  updateActiveIncomeCategories: (categories: string[]) => void;
  toggleActiveIncomeCategory: (category: string) => void;
  isCategoryActiveIncome: (category: string) => boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  colorScheme: 'default',
  targetSavingsRate: 60,
  activeIncomeCategories: [],
};

const STORAGE_KEY = 'finance-settings';

// Load settings from localStorage
const loadFromLocalStorage = (): Settings | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err);
  }
  return null;
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
  const [settings, setSettings] = useState<Settings>(() => {
    return loadFromLocalStorage() || DEFAULT_SETTINGS;
  });

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
