import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { CreditCard, Wallet, Gift, TrendingUp, HelpCircle } from 'lucide-react';
import { UNIFIED_PALETTE } from '@/lib/colorPalette';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'default' | 'swapped';

export const ACCOUNT_TYPE_CONFIG = {
  debit: {
    label: '借记卡',
    description: '现金账户，资金自由出入',
    icon: Wallet,
    color: 'bg-blue-500',
    colorHex: UNIFIED_PALETTE.blue,
  },
  credit: {
    label: '信用卡',
    description: '每个月需要还款',
    icon: CreditCard,
    color: 'bg-red-500',
    colorHex: UNIFIED_PALETTE.red,
  },
  prepaid: {
    label: '预付卡',
    description: '自由转入，特定渠道消费',
    icon: Gift,
    color: 'bg-purple-500',
    colorHex: UNIFIED_PALETTE.purple,
  },
  financial: {
    label: '金融账户',
    description: '金融投资',
    icon: TrendingUp,
    color: 'bg-green-500',
    colorHex: UNIFIED_PALETTE.emerald,
  },
  unclassified: {
    label: '未分类',
    description: '尚未分类',
    icon: HelpCircle,
    color: 'bg-gray-500',
    colorHex: UNIFIED_PALETTE.gray,
  },
} as const;

export type AccountType = 'debit' | 'credit' | 'prepaid' | 'financial' | 'unclassified';

export interface AccountTypeConfig {
  accountName: string;
  type: AccountType;
}

export interface BalanceAnchor {
  accountName: string;
  date: string;  // YYYY-MM-DD
  balance: number;
}

export interface AIConfig {
  enabled: boolean;           // 是否启用 AI 功能
  apiKey: string;             // API Key
  baseURL: string;            // API Base URL
  modelName: string;          // 模型名称
}

interface Settings {
  theme: Theme;
  colorScheme: ColorScheme;
  targetSavingsRate: number;
  activeIncomeCategories: string[];
  fixedExpenseCategories: string[];  // 固定支出分类
  siteName: string;
  minReturnRate: number;      // 保底收益率 (%)
  maxReturnRate: number;      // 风险收益率阈值 (%)
  aiConfig: AIConfig;         // AI 配置
  accountTypes: AccountTypeConfig[];  // 账户类型配置
  balanceAnchors: BalanceAnchor[];    // 余额锚点
}

interface SettingsContextType {
  settings: Settings;
  updateTheme: (theme: Theme) => void;
  updateColorScheme: (scheme: ColorScheme) => void;
  updateTargetSavingsRate: (rate: number) => void;
  updateActiveIncomeCategories: (categories: string[]) => void;
  toggleActiveIncomeCategory: (category: string) => void;
  isCategoryActiveIncome: (category: string) => boolean;
  updateFixedExpenseCategories: (categories: string[]) => void;
  toggleFixedExpenseCategory: (category: string) => void;
  isCategoryFixedExpense: (category: string) => boolean;
  updateSiteName: (name: string) => void;
  updateMinReturnRate: (rate: number) => void;
  updateMaxReturnRate: (rate: number) => void;
  updateAIConfig: (config: AIConfig) => void;
  updateAIEnabled: (enabled: boolean) => void;
  updateAccountTypes: (accountTypes: AccountTypeConfig[]) => void;
  updateAccountType: (accountName: string, type: AccountType) => void;
  getAccountType: (accountName: string) => AccountType;
  updateBalanceAnchors: (anchors: BalanceAnchor[]) => void;
  addBalanceAnchor: (anchor: BalanceAnchor) => void;
  removeBalanceAnchor: (accountName: string, date: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  colorScheme: 'default',
  targetSavingsRate: 60,
  activeIncomeCategories: [],
  fixedExpenseCategories: [],
  siteName: '个人财务管理',
  minReturnRate: 1.25,
  maxReturnRate: 4.0,
  aiConfig: {
    enabled: false,
    apiKey: '',
    baseURL: 'https://api.aihubmix.com/v1',
    modelName: 'gpt-4o-mini',
  },
  accountTypes: [],
  balanceAnchors: [],
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
            ...(settingsData.settings.fixedExpenseCategories && { fixedExpenseCategories: settingsData.settings.fixedExpenseCategories }),
            ...(settingsData.settings.accountTypes && { accountTypes: settingsData.settings.accountTypes }),
            ...(settingsData.settings.balanceAnchors && { balanceAnchors: settingsData.settings.balanceAnchors }),
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

  const updateFixedExpenseCategories = (categories: string[]) => {
    setSettings(prev => ({ ...prev, fixedExpenseCategories: categories }));
  };

  const toggleFixedExpenseCategory = (category: string) => {
    setSettings(prev => {
      const isFixed = prev.fixedExpenseCategories.includes(category);
      const newCategories = isFixed
        ? prev.fixedExpenseCategories.filter(c => c !== category)
        : [...prev.fixedExpenseCategories, category];
      return { ...prev, fixedExpenseCategories: newCategories };
    });
  };

  const isCategoryFixedExpense = (category: string) => {
    return settings.fixedExpenseCategories.includes(category);
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

  const updateAIConfig = (config: AIConfig) => {
    setSettings(prev => ({ ...prev, aiConfig: config }));
  };

  const updateAIEnabled = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, aiConfig: { ...prev.aiConfig, enabled } }));
  };

  const updateAccountTypes = (accountTypes: AccountTypeConfig[]) => {
    setSettings(prev => ({ ...prev, accountTypes }));
  };

  const updateAccountType = (accountName: string, type: AccountType) => {
    setSettings(prev => {
      const existingIndex = prev.accountTypes.findIndex(acc => acc.accountName === accountName);
      let newAccountTypes: AccountTypeConfig[];

      if (existingIndex >= 0) {
        // Update existing
        newAccountTypes = [...prev.accountTypes];
        newAccountTypes[existingIndex] = { accountName, type };
      } else {
        // Add new
        newAccountTypes = [...prev.accountTypes, { accountName, type }];
      }

      return { ...prev, accountTypes: newAccountTypes };
    });
  };

  const getAccountType = (accountName: string): AccountType => {
    const config = settings.accountTypes.find(acc => acc.accountName === accountName);
    return config?.type || 'unclassified';
  };

  const updateBalanceAnchors = (anchors: BalanceAnchor[]) => {
    setSettings(prev => ({ ...prev, balanceAnchors: anchors }));
  };

  const addBalanceAnchor = (anchor: BalanceAnchor) => {
    setSettings(prev => {
      // Remove existing anchor for same account + date if exists
      const filtered = prev.balanceAnchors.filter(
        a => !(a.accountName === anchor.accountName && a.date === anchor.date)
      );
      return { ...prev, balanceAnchors: [...filtered, anchor] };
    });
  };

  const removeBalanceAnchor = (accountName: string, date: string) => {
    setSettings(prev => ({
      ...prev,
      balanceAnchors: prev.balanceAnchors.filter(
        a => !(a.accountName === accountName && a.date === date)
      )
    }));
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
        updateFixedExpenseCategories,
        toggleFixedExpenseCategory,
        isCategoryFixedExpense,
        updateSiteName,
        updateMinReturnRate,
        updateMaxReturnRate,
        updateAIConfig,
        updateAIEnabled,
        updateAccountTypes,
        updateAccountType,
        getAccountType,
        updateBalanceAnchors,
        addBalanceAnchor,
        removeBalanceAnchor,
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

// Savings rate status based on target comparison
export type SavingsRateStatus = 'below' | 'met' | 'exceeded';

export function getSavingsRateStatus(currentRate: number, targetRate: number): SavingsRateStatus {
  if (currentRate >= targetRate + 10) return 'exceeded';  // 超出目标 10%+
  if (currentRate >= targetRate) return 'met';            // 达成目标
  return 'below';                                          // 未达成
}

export function getSavingsRateColor(status: SavingsRateStatus): string {
  switch (status) {
    case 'below':
      return 'text-expense';           // 未达成 - 红色
    case 'met':
      return 'text-income';            // 达成 - 绿色
    case 'exceeded':
      return 'text-emerald-600 dark:text-emerald-400';  // 超出 - 更鲜艳的绿色
  }
}

export function getSavingsRateColorHex(status: SavingsRateStatus): string {
  switch (status) {
    case 'below':
      return '#e11d48';  // Red-600
    case 'met':
      return '#059669';  // Emerald-600
    case 'exceeded':
      return '#22c55e';  // Green-500 (更亮)
  }
}
