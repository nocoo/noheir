import { useCallback, useMemo, useRef, useState } from 'react';
import { useSettings, BalanceAnchor } from '@/contexts/SettingsContext';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import { useTransactions } from '@/hooks/useTransactions';
import { getUniqueAccounts } from '@/domain/settings/accountTypes';
import {
  calculateAnchorDifferences,
  calculateBalanceAtDate,
  groupAnchorsByAccount,
} from '@/domain/settings/balanceAnchors';

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

export function useBalanceAnchorSettingsViewModel(toast: ToastApi) {
  const { settings, addBalanceAnchor, removeBalanceAnchor } = useSettings();
  const { updateSingleSetting } = useSupabaseSettings();
  const { transactions } = useTransactions();

  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [balance, setBalance] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const uniqueAccounts = useMemo(
    () => getUniqueAccounts(transactions),
    [transactions]
  );

  const anchorsByAccount = useMemo(
    () => groupAnchorsByAccount(settings.balanceAnchors || []),
    [settings.balanceAnchors]
  );

  const inputBalance = balance !== '' ? parseFloat(balance) : null;
  const { calculatedBalance, balanceDifference, differenceLevel } = useMemo(() => {
    return calculateBalanceAtDate({
      account: selectedAccount,
      date: selectedDate,
      anchors: settings.balanceAnchors || [],
      transactions,
      inputBalance,
    });
  }, [selectedAccount, selectedDate, settings.balanceAnchors, transactions, inputBalance]);

  const anchorDifferences = useMemo(() => {
    return calculateAnchorDifferences({
      anchorsByAccount,
      anchors: settings.balanceAnchors || [],
      transactions,
    });
  }, [anchorsByAccount, settings.balanceAnchors, transactions]);

  const debouncedUpdateDB = useCallback((newAnchors: BalanceAnchor[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await updateSingleSetting('balanceAnchors', newAnchors);
        toast.success('余额锚点已保存');
      } catch (err) {
        console.error('Failed to update balance anchors:', err);
        toast.error('保存失败，请重试');
      }
    }, 1500);
  }, [updateSingleSetting, toast]);

  const handleAddAnchor = useCallback(() => {
    if (!selectedAccount || !selectedDate || !balance) {
      toast.error('请填写完整信息');
      return;
    }

    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum)) {
      toast.error('请输入有效的金额');
      return;
    }

    if (balanceDifference !== null && balanceDifference >= 1000) {
      toast.error(`差异过大 (¥${balanceDifference.toFixed(2)})，请确认后再添加`);
      return;
    }

    const newAnchor: BalanceAnchor = {
      accountName: selectedAccount,
      date: selectedDate,
      balance: balanceNum,
    };

    addBalanceAnchor(newAnchor);

    const updatedAnchors = settings.balanceAnchors?.filter(
      a => !(a.accountName === selectedAccount && a.date === selectedDate)
    ) || [];
    debouncedUpdateDB([...updatedAnchors, newAnchor]);

    setBalance('');
    toast.success('余额锚点已添加');
  }, [
    selectedAccount,
    selectedDate,
    balance,
    settings.balanceAnchors,
    addBalanceAnchor,
    debouncedUpdateDB,
    balanceDifference,
    toast,
  ]);

  const handleRemoveAnchor = useCallback((accountName: string, date: string) => {
    removeBalanceAnchor(accountName, date);

    const updatedAnchors = settings.balanceAnchors?.filter(
      a => !(a.accountName === accountName && a.date === date)
    ) || [];
    debouncedUpdateDB(updatedAnchors);

    toast.success('余额锚点已删除');
  }, [settings.balanceAnchors, removeBalanceAnchor, debouncedUpdateDB, toast]);

  return {
    uniqueAccounts,
    anchorsByAccount,
    anchorDifferences,
    selectedAccount,
    selectedDate,
    balance,
    calculatedBalance,
    balanceDifference,
    differenceLevel,
    setSelectedAccount,
    setSelectedDate,
    setBalance,
    handleAddAnchor,
    handleRemoveAnchor,
  };
}
