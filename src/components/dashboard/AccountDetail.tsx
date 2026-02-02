import { ChevronUp, ChevronDown } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { useAccountDetailViewModel } from '@/viewmodels/dashboard/useAccountDetailViewModel';
import { getLabelColorClasses } from '@/lib/tagColors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { xAxisStyle, yAxisStyle, gridStyle, tooltipStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';
import { getIncomeColor, getExpenseColor, getIncomeColorHex } from '@/contexts/SettingsContext';
import { Wallet, TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { AccountType, ACCOUNT_TYPE_CONFIG } from '@/contexts/SettingsContext';

interface AccountDetailProps {
  transactions: Transaction[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

export function AccountDetail({ transactions: allTransactions, selectedYear, availableYears, onYearChange }: AccountDetailProps) {
  const {
    settings,
    selectedAccount,
    setSelectedAccount,
    sortColumn,
    sortDirection,
    handleSort,
    accountsByType,
    dailyBalances,
    sortedDisplayEntries,
    summary,
    displayAnchors,
    accountType,
  } = useAccountDetailViewModel({
    transactions: allTransactions,
    selectedYear,
    availableYears,
    onYearChange,
  });

  return (
    <div className="space-y-6">
      {/* Account Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            选择账户
          </CardTitle>
          <CardDescription>查看单个账户的金额变化和交易明细</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(accountsByType) as AccountType[]).map(type => {
                  const config = ACCOUNT_TYPE_CONFIG[type];
                  const accounts = accountsByType[type];

                  if (accounts.length === 0) return null;

                  return (
                    <div key={type}>
                      {/* Type Group Header */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        {config.label}
                      </div>
                      {accounts.map(account => (
                        <SelectItem key={account} value={account}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            <span>{account}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedAccount && (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>初始余额</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrencyFull(summary.initialBalance)}
                  </div>
                  {summary.hasAnchor && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <DollarSign className="h-3 w-3" />
                      基于锚点
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>最终余额</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrencyFull(summary.finalBalance)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    {dailyBalances.length > 0 ? dailyBalances[dailyBalances.length - 1].date : '-'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>总收入</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getIncomeColor(settings.colorScheme)}`}>
                    {formatCurrencyFull(summary.totalIncome)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>总支出</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getExpenseColor(settings.colorScheme)}`}>
                    {formatCurrencyFull(summary.totalExpense)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Balance Trend Chart */}
          {dailyBalances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>余额变化</CardTitle>
                <CardDescription>每日余额趋势</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyBalances}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis
                        dataKey="date"
                        {...xAxisStyle}
                        tickFormatter={(value) => value.substring(5)} // Show MM-DD
                        domain={[`${selectedYear}-01-01`, `${selectedYear}-12-31`]}
                        type="category"
                      />
                      <YAxis
                        {...yAxisStyle}
                        tickFormatter={formatCurrencyK}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle.contentStyle}
                        formatter={(value: number) => [formatCurrencyFull(value), '余额']}
                        labelFormatter={(label) => `日期: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke={getIncomeColorHex(settings.colorScheme)}
                        strokeWidth={2}
                        dot={false}
                      />
                      {/* Add reference lines for balance anchors */}
                      {displayAnchors.map((anchor) => (
                        <ReferenceLine
                          key={anchor.date}
                          x={anchor.date}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `¥${anchor.balance.toFixed(2)}`,
                            position: 'top',
                            fill: 'hsl(var(--text-muted))',
                            fontSize: 11,
                          }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction List */}
          <Card>
            <CardHeader>
              <CardTitle>交易明细</CardTitle>
              <CardDescription>
                {selectedAccount} 的 {sortedDisplayEntries.length} 条交易记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('date')}>
                      <div className="flex items-center gap-1">
                        日期
                        {sortColumn === 'date' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('primaryCategory')}>
                      <div className="flex items-center gap-1">
                        分类
                        {sortColumn === 'primaryCategory' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('type')}>
                      <div className="flex items-center gap-1">
                        类型
                        {sortColumn === 'type' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('amount')}>
                      <div className="flex items-center justify-end gap-1">
                        金额
                        {sortColumn === 'amount' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('balanceAfter')}>
                      <div className="flex items-center justify-end gap-1">
                        余额后
                        {sortColumn === 'balanceAfter' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDisplayEntries.map((entry) => {
                    // Handle anchor entries separately
                    if (entry.isAnchor) {
                      return (
                        <TableRow key={entry.id} className="bg-muted/50 hover:bg-muted/70">
                          <TableCell className="font-medium">{entry.date}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-foreground">{entry.primaryCategory}</span>
                            </div>
                            {entry.note && (
                              <div className="text-xs text-muted-foreground mt-0.5">{entry.note}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-muted border-muted-foreground/50 text-muted-foreground">
                              锚点
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrencyFull(entry.balance)}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // Get color for badge based on type
                    const typeColor = entry.type === 'income'
                      ? getLabelColorClasses('收入')
                      : entry.type === 'expense'
                      ? getLabelColorClasses('支出')
                      : getLabelColorClasses('转账');

                    // Get color for amount based on amount sign
                    const amountColor = entry.amount > 0
                      ? getIncomeColor(settings.colorScheme)
                      : entry.amount < 0
                      ? getExpenseColor(settings.colorScheme)
                      : 'text-muted-foreground';

                    const typeLabel = entry.type === 'income' ? '收入' : entry.type === 'expense' ? '支出' : '转账';

                    // Show prefix based on amount sign (not type)
                    const amountPrefix = entry.amount > 0 ? '+' : entry.amount < 0 ? '-' : '';

                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.primaryCategory || '-'}</div>
                            <div className="text-xs text-muted-foreground">{entry.secondaryCategory || entry.tertiaryCategory || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${typeColor.bg} ${typeColor.text} border-0`}
                          >
                            {typeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${amountColor}`}>
                          {amountPrefix}{formatCurrencyFull(entry.amount)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrencyFull(entry.balance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedAccount && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            请选择一个账户查看详情
          </CardContent>
        </Card>
      )}
    </div>
  );
}
