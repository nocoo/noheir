import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSettings, BalanceAnchor } from '@/contexts/SettingsContext';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactions } from '@/hooks/useTransactions';
import { Calendar, DollarSign, Plus, Trash2, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function BalanceAnchorSettings() {
  const { user } = useAuth();
  const { settings, addBalanceAnchor, removeBalanceAnchor } = useSettings();
  const { transactions } = useTransactions();
  const { data, updateSingleSetting } = useSupabaseSettings();

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [balance, setBalance] = useState<string>('');

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract unique accounts from transactions
  const uniqueAccounts = useMemo(() => {
    const accounts = new Set(transactions.map(t => t.account));
    return Array.from(accounts).sort();
  }, [transactions]);

  // Group anchors by account
  const anchorsByAccount = useMemo(() => {
    const grouped: Record<string, BalanceAnchor[]> = {};
    settings.balanceAnchors?.forEach(anchor => {
      if (!grouped[anchor.accountName]) {
        grouped[anchor.accountName] = [];
      }
      grouped[anchor.accountName].push(anchor);
    });
    // Sort anchors by date descending
    Object.keys(grouped).forEach(account => {
      grouped[account].sort((a, b) => b.date.localeCompare(a.date));
    });
    return grouped;
  }, [settings.balanceAnchors]);

  // Debounced database update
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
  }, [updateSingleSetting]);

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

    const newAnchor: BalanceAnchor = {
      accountName: selectedAccount,
      date: selectedDate,
      balance: balanceNum,
    };

    // Update local context
    addBalanceAnchor(newAnchor);

    // Update database with debounce
    const updatedAnchors = settings.balanceAnchors?.filter(
      a => !(a.accountName === selectedAccount && a.date === selectedDate)
    ) || [];
    debouncedUpdateDB([...updatedAnchors, newAnchor]);

    // Reset form
    setBalance('');
    toast.success('余额锚点已添加');
  }, [selectedAccount, selectedDate, balance, settings.balanceAnchors, addBalanceAnchor, debouncedUpdateDB]);

  const handleRemoveAnchor = useCallback((accountName: string, date: string) => {
    // Update local context
    removeBalanceAnchor(accountName, date);

    // Update database
    const updatedAnchors = settings.balanceAnchors?.filter(
      a => !(a.accountName === accountName && a.date === date)
    ) || [];
    debouncedUpdateDB(updatedAnchors);

    toast.success('余额锚点已删除');
  }, [settings.balanceAnchors, removeBalanceAnchor, debouncedUpdateDB]);

  if (!user || !data?.settings) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          余额锚点设置
        </CardTitle>
        <CardDescription>
          为账户设置已知日期的余额，用于计算历史余额
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            余额锚点是指某一天<strong>结束时的余额</strong>。如果这一天有交易，计算时会将交易处理在余额调整之前。
          </AlertDescription>
        </Alert>

        {/* Add New Anchor Form */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h3 className="font-medium">添加余额锚点</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>账户</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="选择账户" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueAccounts.map(account => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>日期</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label>余额</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleAddAnchor}
                disabled={!selectedAccount || !selectedDate || !balance}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
          </div>
        </div>

        {/* Existing Anchors */}
        <div className="space-y-4">
          <h3 className="font-medium">已设置的余额锚点 ({settings.balanceAnchors?.length || 0})</h3>

          {Object.keys(anchorsByAccount).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无余额锚点
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(anchorsByAccount).map(([accountName, anchors]) => (
                <div key={accountName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{accountName}</h4>
                    <Badge variant="secondary">{anchors.length} 个锚点</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {anchors.map((anchor, index) => (
                      <div
                        key={`${anchor.accountName}-${anchor.date}-${index}`}
                        className="flex items-center justify-between p-3 rounded border bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{anchor.date}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">余额: </span>
                            <span className="font-semibold">¥{anchor.balance.toFixed(2)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAnchor(anchor.accountName, anchor.date)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
