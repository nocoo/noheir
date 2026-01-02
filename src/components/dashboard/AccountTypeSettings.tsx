import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSettings, AccountType } from '@/contexts/SettingsContext';
import { useTransactions } from '@/hooks/useTransactions';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Wallet, Gift, TrendingUp, HelpCircle, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { toast } from 'sonner';

export const ACCOUNT_TYPE_CONFIG = {
  debit: {
    label: '借记卡',
    description: '现金账户，资金自由出入',
    icon: Wallet,
    color: 'bg-blue-500',
  },
  credit: {
    label: '信用卡',
    description: '每个月需要还款',
    icon: CreditCard,
    color: 'bg-red-500',
  },
  prepaid: {
    label: '预付卡',
    description: '自由转入，特定渠道消费',
    icon: Gift,
    color: 'bg-purple-500',
  },
  financial: {
    label: '金融账户',
    description: '金融投资',
    icon: TrendingUp,
    color: 'bg-green-500',
  },
  unclassified: {
    label: '未分类',
    description: '尚未分类',
    icon: HelpCircle,
    color: 'bg-gray-500',
  },
} as const;

export function AccountTypeSettings() {
  const { user } = useAuth();
  const { settings, updateAccountType } = useSettings();
  const { transactions } = useTransactions();
  const { data, updateSingleSetting } = useSupabaseSettings();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract unique accounts from transactions
  const uniqueAccounts = useMemo(() => {
    const accounts = new Set(transactions.map(t => t.account));
    return Array.from(accounts).sort();
  }, [transactions]);

  // Group accounts by type for better display
  const accountsByType = useMemo(() => {
    const grouped: Record<AccountType, string[]> = {
      debit: [],
      credit: [],
      prepaid: [],
      financial: [],
      unclassified: [],
    };

    uniqueAccounts.forEach(account => {
      const config = settings.accountTypes?.find(acc => acc.accountName === account);
      const type = config?.type || 'unclassified';
      grouped[type].push(account);
    });

    return grouped;
  }, [uniqueAccounts, settings.accountTypes]);

  // Debounced database update
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
  }, [updateSingleSetting]);

  const handleTypeChange = useCallback((accountName: string, newType: AccountType) => {
    // Immediately update local context
    updateAccountType(accountName, newType);

    // Debounce database update
    const existingIndex = settings.accountTypes.findIndex(acc => acc.accountName === accountName);
    let newAccountTypes = [...settings.accountTypes];

    if (existingIndex >= 0) {
      newAccountTypes[existingIndex] = { accountName, type: newType };
    } else {
      newAccountTypes = [...newAccountTypes, { accountName, type: newType }];
    }

    debouncedUpdateDB(newAccountTypes);
  }, [settings.accountTypes, updateAccountType, debouncedUpdateDB]);

  const handleBatchUpdate = useCallback((accounts: string[], type: AccountType) => {
    // Update each account
    const newAccountTypes = [...(settings.accountTypes || [])];

    accounts.forEach(accountName => {
      const existingIndex = newAccountTypes.findIndex(acc => acc.accountName === accountName);
      if (existingIndex >= 0) {
        newAccountTypes[existingIndex] = { accountName, type };
      } else {
        newAccountTypes.push({ accountName, type });
      }
      // Update local context
      updateAccountType(accountName, type);
    });

    // Update database
    debouncedUpdateDB(newAccountTypes);
    toast.success(`已将 ${accounts.length} 个账户设为${ACCOUNT_TYPE_CONFIG[type].label}`);
  }, [settings.accountTypes, updateAccountType, debouncedUpdateDB]);

  const getTypeLabel = (type: AccountType): string => {
    return ACCOUNT_TYPE_CONFIG[type].label;
  };

  const stats = useMemo(() => {
    return Object.entries(accountsByType).map(([type, accounts]) => ({
      type: type as AccountType,
      count: accounts.length,
      config: ACCOUNT_TYPE_CONFIG[type as AccountType],
    }));
  }, [accountsByType]);

  // Early return AFTER all hooks
  if (!user || !data?.settings) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats.map(({ type, count, config }) => {
            const Icon = config.icon;
            return (
              <div
                key={type}
                className={`p-3 rounded-lg border ${count === 0 ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded ${config.color} text-white`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {config.description}
                </div>
              </div>
            );
          })}
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            系统已从交易数据中识别出 <span className="font-semibold">{uniqueAccounts.length}</span> 个不同的账户，
            请为每个账户设置正确的类型。
          </AlertDescription>
        </Alert>

        {/* Account List by Type */}
        <div className="space-y-4">
          {(Object.entries(accountsByType) as [AccountType, string[]][]).map(([type, accounts]) => {
            if (accounts.length === 0) return null;

            const config = ACCOUNT_TYPE_CONFIG[type];
            const Icon = config.icon;

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${config.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">{config.label}</h3>
                  <Badge variant="secondary">{accounts.length}</Badge>
                  <span className="text-xs text-muted-foreground ml-2">
                    {config.description}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {accounts.map(account => (
                    <div
                      key={account}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <span className="text-sm font-medium truncate flex-1 mr-2" title={account}>
                        {account}
                      </span>
                      <Select
                        value={type}
                        onValueChange={(value) => handleTypeChange(account, value as AccountType)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ACCOUNT_TYPE_CONFIG) as [AccountType, typeof config][]).map(
                            ([t, c]) => (
                              <SelectItem key={t} value={t}>
                                <div className="flex items-center gap-2">
                                  <c.icon className="h-3 w-3" />
                                  <span>{c.label}</span>
                                </div>
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Batch Actions */}
        {accountsByType.unclassified.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">批量设置未分类账户</h4>
                <p className="text-sm text-muted-foreground">
                  有 {accountsByType.unclassified.length} 个账户尚未分类
                </p>
              </div>
              <div className="flex gap-2">
                {(Object.keys(ACCOUNT_TYPE_CONFIG) as AccountType[]).filter(t => t !== 'unclassified').map(type => {
                  const config = ACCOUNT_TYPE_CONFIG[type];
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleBatchUpdate(accountsByType.unclassified, type)}
                    >
                      <config.icon className="h-4 w-4 mr-1" />
                      全部设为{config.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
