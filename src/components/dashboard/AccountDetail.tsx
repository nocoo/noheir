import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { Transfer } from '@/types/data';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransfers } from '@/hooks/useTransfers';
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

interface DisplayEntry {
  id: string;
  date: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  tertiaryCategory?: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  balance: number;
  balanceAfter: number;
  note?: string;
}

// Unified entry for balance calculation (from Transaction or Transfer)
interface BalanceEntry {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  account: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number; // For income/expense: positive amount; For transfer: inflow - outflow
  primaryCategory?: string;
  secondaryCategory?: string;
  tertiaryCategory?: string;
  description?: string;
  originalData: Transaction | Transfer; // Keep reference for display
}

export function AccountDetail({ transactions: allTransactions, selectedYear, availableYears, onYearChange }: AccountDetailProps) {
  const { settings } = useSettings();
  const { transfers } = useTransfers();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<keyof DisplayEntry>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter transactions by selected year
  const transactions = useMemo(() => {
    return allTransactions.filter(t => t.year === selectedYear);
  }, [allTransactions, selectedYear]);

  // Merge transactions and transfers into unified balance entries
  const allBalanceEntries = useMemo(() => {
    const entries: BalanceEntry[] = [];

    // Add transactions
    allTransactions.forEach(t => {
      entries.push({
        id: `tx-${t.id}`,
        date: t.date,
        year: t.year,
        month: t.month,
        day: new Date(t.date).getDate(),
        account: t.account,
        type: t.type,
        amount: t.type === 'income' ? t.amount : -t.amount,
        primaryCategory: t.primaryCategory,
        secondaryCategory: t.secondaryCategory,
        tertiaryCategory: t.tertiaryCategory,
        description: t.description,
        originalData: t,
      });
    });

    // Add transfers - split into fromAccount and toAccount entries
    transfers.forEach(t => {
      const inflow = t.inflow_amount || 0;
      const outflow = t.outflow_amount || 0;

      // Parse account names from the raw account field
      // Format: "平安银行-私行卡7777 → 支付宝-家庭基金"
      const accountParts = t.account.split('→').map(s => s.trim());
      const fromAccount = accountParts[0] || t.account;
      const toAccount = accountParts[1] || t.account;

      // Add entry for FROM account (money going out)
      if (outflow > 0 && fromAccount) {
        entries.push({
          id: `tf-from-${t.id}`,
          date: t.date,
          year: t.year,
          month: t.month,
          day: t.day,
          account: fromAccount,
          type: 'transfer',
          amount: -outflow,  // Negative: money leaving fromAccount
          primaryCategory: t.primary_category || undefined,
          secondaryCategory: t.secondary_category,
          tertiaryCategory: `转出 → ${toAccount}`,
          description: t.note || undefined,
          originalData: t,
        });
      }

      // Add entry for TO account (money coming in)
      if (inflow > 0 && toAccount) {
        entries.push({
          id: `tf-to-${t.id}`,
          date: t.date,
          year: t.year,
          month: t.month,
          day: t.day,
          account: toAccount,
          type: 'transfer',
          amount: inflow,  // Positive: money entering toAccount
          primaryCategory: t.primary_category || undefined,
          secondaryCategory: t.secondary_category,
          tertiaryCategory: `转入 ← ${fromAccount}`,
          description: t.note || undefined,
          originalData: t,
        });
      }
    });

    // Sort by date
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [allTransactions, transfers]);

  // Extract unique accounts from all balance entries
  const uniqueAccounts = useMemo(() => {
    const accounts = new Set(allBalanceEntries.map(e => e.account));
    return Array.from(accounts).sort();
  }, [allBalanceEntries]);

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
  const { dailyBalances, displayEntries, summary, displayAnchors } = useMemo(() => {
    if (!selectedAccount) {
      return { dailyBalances: [], displayEntries: [], summary: null, displayAnchors: [] };
    }

    // Get all balance entries for this account (from all data), sorted by date
    const accountEntries = allBalanceEntries
      .filter(e => e.account === selectedAccount)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (accountEntries.length === 0) {
      return { dailyBalances: [], displayEntries: [], summary: null };
    }

    // Get balance anchor for this account
    const accountAnchors = settings.balanceAnchors
      ?.filter(a => a.accountName === selectedAccount)
      .sort((a, b) => a.date.localeCompare(b.date)) || []; // Sort ascending

    // Define year start date first
    const yearStartDate = `${selectedYear}-01-01`;

    // Filter anchors to only those within the selected year for display
    const displayAnchors = accountAnchors.filter(a => a.date >= yearStartDate && a.date <= `${selectedYear}-12-31`);

    // Find the latest anchor on or before Jan 1 of selected year to use as starting point
    const startingAnchor = accountAnchors.filter(a => a.date <= yearStartDate).pop(); // Get last one before/on year start
    const startingBalance = startingAnchor?.balance || 0;

    // Collect ALL relevant anchors for the year (including starting anchor for context)
    let yearAnchors = [
      ...(startingAnchor ? [{ ...startingAnchor, isStarting: true }] : []),
      ...displayAnchors.map(a => ({ ...a, isStarting: false }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    // If no anchors at all, create a default starting anchor at year start with 0 balance
    if (yearAnchors.length === 0) {
      yearAnchors = [{ accountName: selectedAccount, date: yearStartDate, balance: 0, isStarting: true }];
    }

    // Calculate daily balances for the selected year using all anchors
    const balanceMap = new Map<string, DailyBalance>();

    // Process entries in segments between anchors
    for (let i = 0; i < yearAnchors.length; i++) {
      const currentAnchor = yearAnchors[i];
      const nextAnchor = yearAnchors[i + 1];

      let segmentStartBalance = currentAnchor.balance;
      const segmentStartDate = currentAnchor.isStarting ? yearStartDate : currentAnchor.date;
      const segmentEndDate = nextAnchor ? nextAnchor.date : `${selectedYear}-12-31`;

      // Process entries in this segment
      for (const entry of accountEntries) {
        if (entry.date < segmentStartDate) continue;
        if (entry.date > segmentEndDate) break;

        // Skip entry if it's exactly on the anchor date (anchor represents balance AFTER processing that day)
        if (!currentAnchor.isStarting && entry.date === currentAnchor.date) {
          continue;
        }

        const date = entry.date;
        if (!balanceMap.has(date)) {
          balanceMap.set(date, {
            date,
            balance: segmentStartBalance,
            income: 0,
            expense: 0,
          });
        }

        const dayData = balanceMap.get(date)!;
        segmentStartBalance += entry.amount;

        // Track income/expense separately for display
        if (entry.type === 'income') {
          dayData.income += Math.abs(entry.amount);
        } else if (entry.type === 'expense') {
          dayData.expense += Math.abs(entry.amount);
        }

        dayData.balance = segmentStartBalance;
      }
    }

    // Convert to array and sort by date
    const dailyBalances = Array.from(balanceMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Add balance to each entry for the selected year (including transfers)
    // Using anchor-based calculation for accurate balance tracking
    const displayEntries: DisplayEntry[] = [];

    // Process entries in segments between anchors for display entries
    for (let i = 0; i < yearAnchors.length; i++) {
      const currentAnchor = yearAnchors[i];
      const nextAnchor = yearAnchors[i + 1];

      let segmentBalance = currentAnchor.balance;
      const segmentStartDate = currentAnchor.isStarting ? yearStartDate : currentAnchor.date;
      const segmentEndDate = nextAnchor ? nextAnchor.date : `${selectedYear}-12-31`;

      for (const entry of accountEntries) {
        if (entry.date < segmentStartDate) continue;
        if (entry.date > segmentEndDate) break;

        // Skip entry if it's exactly on the anchor date
        if (!currentAnchor.isStarting && entry.date === currentAnchor.date) {
          continue;
        }

        segmentBalance += entry.amount;

        // Add all entries to display list (including transfers)
        displayEntries.push({
          id: entry.id,
          date: entry.date,
          primaryCategory: entry.primaryCategory,
          secondaryCategory: entry.secondaryCategory,
          tertiaryCategory: entry.tertiaryCategory,
          type: entry.type,
          amount: Math.abs(entry.amount),
          balance: segmentBalance,
          balanceAfter: segmentBalance,
          note: entry.description,
        });
      }
    }

    // Sort display entries by date
    displayEntries.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary for selected year
    const yearEntries = accountEntries.filter(
      e => e.year === selectedYear
    );
    const income = yearEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const expense = yearEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const finalBalance = displayEntries.length > 0
      ? displayEntries[displayEntries.length - 1].balance
      : startingBalance;

    const summary = {
      totalIncome: income,
      totalExpense: expense,
      transactionCount: displayEntries.length,
      initialBalance: startingBalance,
      finalBalance,
      hasAnchor: !!startingAnchor,
    };

    return { dailyBalances, displayEntries, summary, displayAnchors };
  }, [selectedAccount, allBalanceEntries, settings.balanceAnchors, selectedYear]);

  // Get account type
  const accountType = settings.accountTypes?.find(c => c.accountName === selectedAccount)?.type || 'unclassified';
  const typeConfig = ACCOUNT_TYPE_CONFIG[accountType];

  // Sort display entries based on current sort column and direction
  const sortedDisplayEntries = useMemo(() => {
    if (!displayEntries.length) return [];

    const sorted = [...displayEntries].sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      // Handle special cases
      if (sortColumn === 'type') {
        // Sort by type label
        const typeLabels = { income: '收入', expense: '支出', transfer: '转账' };
        aVal = typeLabels[a.type as keyof typeof typeLabels];
        bVal = typeLabels[b.type as keyof typeof typeLabels];
      } else if (sortColumn === 'primaryCategory') {
        aVal = a.primaryCategory || '';
        bVal = b.primaryCategory || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [displayEntries, sortColumn, sortDirection]);

  // Handle sort column change
  const handleSort = (column: keyof DisplayEntry) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc for numbers/amount, asc for text
      setSortColumn(column);
      setSortDirection(column === 'amount' || column === 'balanceAfter' ? 'desc' : 'asc');
    }
  };

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
                      {/* Add reference lines for balance anchors */}
                      {displayAnchors.map((anchor) => (
                        <ReferenceLine
                          key={anchor.date}
                          x={anchor.date}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `锚点: ¥${anchor.balance.toFixed(2)}`,
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
