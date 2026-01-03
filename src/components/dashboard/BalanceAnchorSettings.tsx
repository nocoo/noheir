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
import { Calendar, DollarSign, Plus, Trash2, AlertCircle, Calculator, AlertTriangle } from 'lucide-react';
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

  // Calculate theoretical balance at selected date for selected account
  const { calculatedBalance, balanceDifference, differenceLevel } = useMemo(() => {
    if (!selectedAccount || !selectedDate) {
      return { calculatedBalance: null, balanceDifference: null, differenceLevel: null };
    }

    // Get all anchors for this account, sorted ascending
    const accountAnchors = (settings.balanceAnchors || [])
      .filter(a => a.accountName === selectedAccount && a.date <= selectedDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Find the most recent anchor before or on the selected date
    const baseAnchor = accountAnchors.length > 0 ? accountAnchors[accountAnchors.length - 1] : null;
    const baseBalance = baseAnchor?.balance || 0;
    const baseDate = baseAnchor?.date || '2000-01-01';

    // Get all transactions for this account
    const accountTransactions = transactions.filter(t => t.account === selectedAccount);

    // Calculate balance from base anchor to selected date
    let calculated = baseBalance;
    accountTransactions.forEach(t => {
      // Skip transactions on or before base date (they're already included in base anchor)
      if (t.fullDate <= baseDate) return;
      // Skip transactions after selected date
      if (t.fullDate > selectedDate) return;

      // Add transaction amount (positive for income, negative for expense)
      calculated += t.income || 0;
      calculated -= t.expense || 0;
    });

    const inputBalance = balance !== '' ? parseFloat(balance) : null;
    const difference = inputBalance !== null ? Math.abs(inputBalance - calculated) : null;

    // Determine warning level
    let level: 'none' | 'info' | 'warning' | 'error' | null = null;
    if (difference !== null) {
      if (difference < 1) {
        level = 'none';
      } else if (difference < 100) {
        level = 'info';
      } else if (difference < 1000) {
        level = 'warning';
      } else {
        level = 'error';
      }
    }

    return {
      calculatedBalance: calculated,
      balanceDifference: difference,
      differenceLevel: level
    };
  }, [selectedAccount, selectedDate, balance, transactions, settings.balanceAnchors]);

  // Calculate difference for each existing anchor
  const anchorDifferences = useMemo(() => {
    const differences: Record<string, number> = {};

    Object.entries(anchorsByAccount).forEach(([accountName, anchors]) => {
      anchors.forEach(anchor => {
        // Get all anchors for this account before this date
        const previousAnchors = (settings.balanceAnchors || [])
          .filter(a => a.accountName === accountName && a.date < anchor.date)
          .sort((a, b) => a.date.localeCompare(b.date));

        // Find base anchor
        const baseAnchor = previousAnchors.length > 0 ? previousAnchors[previousAnchors.length - 1] : null;
        const baseBalance = baseAnchor?.balance || 0;
        const baseDate = baseAnchor?.date || '2000-01-01';

        // Get all transactions for this account
        const accountTransactions = transactions.filter(t => t.account === accountName);

        // Calculate balance from base anchor to this anchor date
        let calculated = baseBalance;
        accountTransactions.forEach(t => {
          if (t.fullDate <= baseDate) return;
          if (t.fullDate > anchor.date) return;
          calculated += t.income || 0;
          calculated -= t.expense || 0;
        });

        const diff = Math.abs(anchor.balance - calculated);
        differences[`${accountName}-${anchor.date}`] = diff;
      });
    });

    return differences;
  }, [anchorsByAccount, settings.balanceAnchors, transactions]);

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

    // Check for large differences before adding
    if (balanceDifference !== null && balanceDifference >= 1000) {
      toast.error(`差异过大 (¥${balanceDifference.toFixed(2)})，请确认后再添加`);
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
  }, [selectedAccount, selectedDate, balance, settings.balanceAnchors, addBalanceAnchor, debouncedUpdateDB, balanceDifference]);

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
                disabled={!selectedAccount || !selectedDate || balance === ''}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
          </div>

          {/* Balance Difference Warning */}
          {calculatedBalance !== null && (
            <div className={`p-3 rounded border ${
              differenceLevel === 'error' ? 'bg-destructive/10 border-destructive/30' :
              differenceLevel === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
              differenceLevel === 'info' ? 'bg-blue-500/10 border-blue-500/30' :
              'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="flex items-start gap-2">
                <Calculator className={`h-4 w-4 mt-0.5 ${
                  differenceLevel === 'error' ? 'text-destructive' :
                  differenceLevel === 'warning' ? 'text-orange-500' :
                  differenceLevel === 'info' ? 'text-blue-500' :
                  'text-green-500'
                }`} />
                <div className="flex-1 text-sm">
                  <div className="font-medium mb-1">
                    {differenceLevel === 'error' && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        差异较大，请确认
                      </span>
                    )}
                    {differenceLevel === 'warning' && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        存在差异，建议核对
                      </span>
                    )}
                    {differenceLevel === 'info' && (
                      <span className="text-blue-500">存在小额差异</span>
                    )}
                    {differenceLevel === 'none' && (
                      <span className="text-green-600 flex items-center gap-1">
                        ✓ 余额一致
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-muted-foreground">
                    <div>根据交易记录计算: <span className="font-semibold text-foreground">¥{calculatedBalance.toFixed(2)}</span></div>
                    {balanceDifference !== null && balanceDifference > 0 && (
                      <div>差异金额: <span className={`font-semibold ${
                        differenceLevel === 'error' ? 'text-destructive' :
                        differenceLevel === 'warning' ? 'text-orange-500' :
                        'text-foreground'
                      }`}>¥{balanceDifference.toFixed(2)}</span></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
                    {anchors.map((anchor, index) => {
                      const diff = anchorDifferences[`${anchor.accountName}-${anchor.date}`] || 0;
                      const diffLevel = diff >= 1000 ? 'error' : diff >= 100 ? 'warning' : diff >= 1 ? 'info' : 'none';

                      return (
                        <div
                          key={`${anchor.accountName}-${anchor.date}-${index}`}
                          className="flex items-center justify-between p-3 rounded border bg-card"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{anchor.date}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">余额: </span>
                              <span className="font-semibold">¥{anchor.balance.toFixed(2)}</span>
                            </div>
                            {diffLevel !== 'none' && (
                              <div className={`text-xs px-2 py-1 rounded ${
                                diffLevel === 'error' ? 'bg-destructive/10 text-destructive' :
                                diffLevel === 'warning' ? 'bg-orange-500/10 text-orange-500' :
                                'bg-blue-500/10 text-blue-500'
                              }`}>
                                差异: ¥{diff.toFixed(2)}
                              </div>
                            )}
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
                      );
                    })}
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
