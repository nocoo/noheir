import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
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
import { useBalanceAnchorSettingsViewModel } from '@/viewmodels/settings/useBalanceAnchorSettingsViewModel';
import { useSettings } from '@/contexts/SettingsContext';

export function BalanceAnchorSettings() {
  const { user } = useAuth();
  const {
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
  } = useBalanceAnchorSettingsViewModel(toast);

  const { settings } = useSettings();

  if (!user) {
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
