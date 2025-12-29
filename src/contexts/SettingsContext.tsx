import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'default' | 'swapped';

interface Settings {
  theme: Theme;
  colorScheme: ColorScheme;
}

interface SettingsContextType {
  settings: Settings;
  updateTheme: (theme: Theme) => void;
  updateColorScheme: (scheme: ColorScheme) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  colorScheme: 'default',
};

const SETTINGS_KEY = 'finance-analyzer-settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Settings;
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

  return (
    <SettingsContext.Provider value={{ settings, updateTheme, updateColorScheme }}>
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

// Helper to get colors based on scheme
export function getIncomeColor(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
}

export function getExpenseColor(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
}

export function getIncomeColorHex(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'hsl(0, 72%, 50%)' : 'hsl(142, 76%, 36%)';
}

export function getExpenseColorHex(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'hsl(142, 76%, 36%)' : 'hsl(0, 72%, 50%)';
}
