import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
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
import { useAccountTypeSettingsViewModel } from '@/viewmodels/settings/useAccountTypeSettingsViewModel';
import { ACCOUNT_TYPE_CONFIG, AccountType } from '@/contexts/SettingsContext';


export function AccountTypeSettings() {
  const { user } = useAuth();
  const {
    isReady,
    uniqueAccounts,
    accountsByType,
    stats,
    handleTypeChange,
    handleBatchUpdate,
  } = useAccountTypeSettingsViewModel(toast);

  // Early return AFTER all hooks
  if (!user || !isReady) {
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
