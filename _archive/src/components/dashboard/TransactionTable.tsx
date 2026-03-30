import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/chart-config';
import { useSettings, getIncomeColor, getExpenseColor } from '@/contexts/SettingsContext';
import { getLabelColorClasses } from '@/lib/tagColors';
import { List } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);

  // Sort by date descending (most recent first) and take top 10
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [transactions]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5 text-primary" />
          最近交易记录
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead>
              <TableHead>一级分类</TableHead>
              <TableHead>二级分类</TableHead>
              <TableHead>三级分类</TableHead>
              <TableHead>账户</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="text-right">金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无交易记录，请导入数据
                </TableCell>
              </TableRow>
            ) : (
              recentTransactions.map((transaction) => {
                const primaryColor = getLabelColorClasses(transaction.primaryCategory);
                const secondaryColor = getLabelColorClasses(transaction.secondaryCategory);
                const tertiaryColor = getLabelColorClasses(transaction.tertiaryCategory);

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.date}</TableCell>
                    <TableCell>
                      <Badge className={cn(primaryColor.bg, primaryColor.text)}>
                        {transaction.primaryCategory}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(secondaryColor.bg, secondaryColor.text)}>
                        {transaction.secondaryCategory}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(tertiaryColor.bg, tertiaryColor.text)}>
                        {transaction.tertiaryCategory}
                      </Badge>
                    </TableCell>
                    <TableCell>{transaction.account}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={transaction.description}>
                      {transaction.description || '-'}
                    </TableCell>
                    <TableCell className={cn(
                      'text-right font-medium',
                      transaction.type === 'income' ? incomeColorClass : expenseColorClass
                    )}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrencyFull(transaction.amount)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
