import { useState, useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { useSettings } from '@/contexts/SettingsContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { xAxisStyle, yAxisStyle, gridStyle, tooltipStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';
import { getIncomeColor, getExpenseColor, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { Wallet, TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { AccountType, ACCOUNT_TYPE_CONFIG } from '@/contexts/SettingsContext';
import { YearSelector } from '@/components/dashboard/YearSelector';

interface AccountDetailProps {
  transactions: Transaction[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

interface DailyBalance {
  date: string;
  balance: number;
  income: number;
  expense: number;
}

interface TransactionWithBalance extends Transaction {
  balance: number;
}

export function AccountDetail({ transactions: allTransactions, selectedYear, availableYears, onYearChange }: AccountDetailProps) {
  const { settings } = useSettings();
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // Filter transactions by selected year
  const transactions = useMemo(() => {
    return allTransactions.filter(t => t.year === selectedYear);
  }, [allTransactions, selectedYear]);

  // Extract unique accounts from all transactions
  const uniqueAccounts = useMemo(() => {
    const accounts = new Set(allTransactions.map(t => t.account));
    return Array.from(accounts).sort();
  }, [allTransactions]);

  // Group accounts by type
  const accountsByType = useMemo(() => {
    const grouped: Record<AccountType, string[]> = {
      debit: [],
      credit: [],
      prepaid: [],
      financial: [],
      unclassified: [],
    };

    uniqueAccounts.forEach(account => {
      const type = settings.accountTypes?.find(c => c.accountName === account)?.type || 'unclassified';
      grouped[type].push(account);
    });

    // Sort accounts within each type
    Object.keys(grouped).forEach(type => {
      grouped[type as AccountType].sort();
    });

    return grouped;
  }, [uniqueAccounts, settings.accountTypes]);

  // Calculate daily balance for selected account (for the entire year)
  const { dailyBalances, transactionsWithBalance, summary } = useMemo(() => {
    if (!selectedAccount) {
      return { dailyBalances: [], transactionsWithBalance: [], summary: null };
    }

    // Get all transactions for this account (from all data), sorted by date
    const accountTransactions = allTransactions
      .filter(t => t.account === selectedAccount)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (accountTransactions.length === 0) {
      return { dailyBalances: [], transactionsWithBalance: [], summary: null };
    }

    // Get balance anchor for this account
    const accountAnchors = settings.balanceAnchors
      ?.filter(a => a.accountName === selectedAccount)
      .sort((a, b) => b.date.localeCompare(a.date)) || [];

    // Find the latest anchor on or before Jan 1 of selected year
    const yearStartDate = `${selectedYear}-01-01`;
    const anchor = accountAnchors.find(a => a.date <= yearStartDate);
    const anchorBalance = anchor?.balance || 0;

    // Calculate daily balances for the selected year
    const balanceMap = new Map<string, DailyBalance>();
    let currentBalance = anchorBalance;
    let passedAnchor = !anchor; // If no anchor, all transactions count

    // Process all transactions to get to the start of the year
    for (const t of accountTransactions) {
      if (t.date < yearStartDate) {
        // Before selected year, just track balance
        if (t.date === anchor?.date) {
          // Skip transactions on anchor date
          continue;
        }
        if (t.type === 'income') {
          currentBalance += t.amount;
        } else if (t.type === 'expense') {
          currentBalance -= t.amount;
        }
        continue;
      }

      if (t.date > `${selectedYear}-12-31`) {
        break; // Past selected year
      }

      // Within selected year
      const date = t.date;
      if (!balanceMap.has(date)) {
        balanceMap.set(date, {
          date,
          balance: currentBalance,
          income: 0,
          expense: 0,
        });
      }

      const dayData = balanceMap.get(date)!;
      if (t.type === 'income') {
        currentBalance += t.amount;
        dayData.income += t.amount;
      } else if (t.type === 'expense') {
        currentBalance -= t.amount;
        dayData.expense += t.amount;
      }
      dayData.balance = currentBalance;
    }

    // Convert to array and sort by date
    const dailyBalances = Array.from(balanceMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Add balance to each transaction for the selected year
    const transactionsWithBalance: TransactionWithBalance[] = [];
    let balance = anchorBalance;
    let processedStart = false;

    // First, process all transactions before selected year to get starting balance
    for (const t of accountTransactions) {
      if (t.date < yearStartDate) {
        if (t.date === anchor?.date) continue;
        if (t.type === 'income') {
          balance += t.amount;
        } else if (t.type === 'expense') {
          balance -= t.amount;
        }
        continue;
      }

      if (t.date > `${selectedYear}-12-31`) {
        break; // Past selected year
      }

      // Within selected year
      if (t.type === 'income') {
        balance += t.amount;
      } else if (t.type === 'expense') {
        balance -= t.amount;
      }

      transactionsWithBalance.push({
        ...t,
        balance,
      });
    }

    // Calculate summary for selected year
    const yearTransactions = accountTransactions.filter(
      t => t.year === selectedYear && t.date !== anchor?.date
    );
    const income = yearTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = yearTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const finalBalance = transactionsWithBalance.length > 0
      ? transactionsWithBalance[transactionsWithBalance.length - 1].balance
      : balance;

    const summary = {
      totalIncome: income,
      totalExpense: expense,
      transactionCount: yearTransactions.length,
      initialBalance: anchorBalance,
      finalBalance,
      hasAnchor: !!anchor,
    };

    return { dailyBalances, transactionsWithBalance, summary };
  }, [selectedAccount, allTransactions, settings.balanceAnchors, selectedYear]);

  // Get account type
  const accountType = settings.accountTypes?.find(c => c.accountName === selectedAccount)?.type || 'unclassified';
  const typeConfig = ACCOUNT_TYPE_CONFIG[accountType];

  return (
    <div className="space-y-6">
      {/* Account Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            账户详情
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
                {selectedAccount} 的 {transactionsWithBalance.length} 条交易记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">余额后</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsWithBalance.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.date}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{t.primaryCategory}</div>
                          <div className="text-xs text-muted-foreground">{t.secondaryCategory}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.type === 'income' ? 'default' : 'secondary'}
                          className={t.type === 'income' ? getIncomeColor(settings.colorScheme) : getExpenseColor(settings.colorScheme)}
                        >
                          {t.type === 'income' ? '收入' : '支出'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        t.type === 'income' ? getIncomeColor(settings.colorScheme) : getExpenseColor(settings.colorScheme)
                      }`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrencyFull(t.amount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrencyFull(t.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
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
