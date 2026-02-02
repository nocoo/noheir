import { useCallback, useMemo, useRef } from 'react';
import { useSettings, AccountType, ACCOUNT_TYPE_CONFIG } from '@/contexts/SettingsContext';
import { useTransactions } from '@/hooks/useTransactions';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import {
  applyBatchAccountTypes,
  buildAccountTypesUpdate,
  getUniqueAccounts,
  groupAccountsByType,
} from '@/domain/settings/accountTypes';

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

export function useAccountTypeSettingsViewModel(toast: ToastApi) {
  const { settings, updateAccountType } = useSettings();
  const { transactions } = useTransactions();
  const { data, updateSingleSetting } = useSupabaseSettings();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const uniqueAccounts = useMemo(
    () => getUniqueAccounts(transactions),
    [transactions]
  );

  const accountsByType = useMemo(
    () => groupAccountsByType(uniqueAccounts, settings.accountTypes),
    [uniqueAccounts, settings.accountTypes]
  );

  const stats = useMemo(() => {
    return Object.entries(accountsByType).map(([type, accounts]) => ({
      type: type as AccountType,
      count: accounts.length,
      config: ACCOUNT_TYPE_CONFIG[type as AccountType],
    }));
  }, [accountsByType]);

  const debouncedUpdateDB = useCallback((newAccountTypes: typeof settings.accountTypes) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await updateSingleSetting('accountTypes', newAccountTypes);
        toast.success('账户类型已保存');
      } catch (err) {
        console.error('Failed to update account types:', err);
        toast.error('保存失败，请重试');
      }
    }, 1500);
  }, [updateSingleSetting, toast]);

  const handleTypeChange = useCallback((accountName: string, newType: AccountType) => {
    updateAccountType(accountName, newType);
    const newAccountTypes = buildAccountTypesUpdate(settings.accountTypes, accountName, newType);
    debouncedUpdateDB(newAccountTypes);
  }, [settings.accountTypes, updateAccountType, debouncedUpdateDB]);

  const handleBatchUpdate = useCallback((accounts: string[], type: AccountType) => {
    const newAccountTypes = applyBatchAccountTypes(settings.accountTypes, accounts, type);
    accounts.forEach(accountName => updateAccountType(accountName, type));
    debouncedUpdateDB(newAccountTypes);
    toast.success(`已将 ${accounts.length} 个账户设为${ACCOUNT_TYPE_CONFIG[type].label}`);
  }, [settings.accountTypes, updateAccountType, debouncedUpdateDB, toast]);

  return {
    isReady: Boolean(data?.settings),
    uniqueAccounts,
    accountsByType,
    stats,
    handleTypeChange,
    handleBatchUpdate,
  };
}
