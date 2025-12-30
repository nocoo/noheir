import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'default' | 'swapped';

interface Settings {
  theme: Theme;
  colorScheme: ColorScheme;
  targetSavingsRate: number; // 目标储蓄率，0-100
}

interface SettingsContextType {
  settings: Settings;
  updateTheme: (theme: Theme) => void;
  updateColorScheme: (scheme: ColorScheme) => void;
  updateTargetSavingsRate: (rate: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  colorScheme: 'default',
  targetSavingsRate: 60, // 默认60%
};

const SETTINGS_KEY = 'finance-analyzer-settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        // Merge with defaults to handle missing fields
        return {
          theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
          colorScheme: parsed.colorScheme ?? DEFAULT_SETTINGS.colorScheme,
          targetSavingsRate: parsed.targetSavingsRate ?? DEFAULT_SETTINGS.targetSavingsRate,
        };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

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

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateTheme = (theme: Theme) => {
    setSettings(prev => ({ ...prev, theme }));
  };

  const updateColorScheme = (colorScheme: ColorScheme) => {
    setSettings(prev => ({ ...prev, colorScheme }));
  };

  const updateTargetSavingsRate = (rate: number) => {
    setSettings(prev => ({ ...prev, targetSavingsRate: rate }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateTheme, updateColorScheme, updateTargetSavingsRate }}>
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
  // Emerald-600 for income: #059669
  return scheme === 'swapped' ? '#e11d48' : '#059669';
}

export function getExpenseColorHex(scheme: ColorScheme): string {
  // Rose-600 for expense: #e11d48
  return scheme === 'swapped' ? '#059669' : '#e11d48';
}
