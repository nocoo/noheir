import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/chart-config';
import { useSettings, getIncomeColor, getExpenseColor } from '@/contexts/SettingsContext';
import { List } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const recentTransactions = transactions.slice(0, 10);

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
              <TableHead>账户</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="text-right">金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  暂无交易记录，请导入数据
                </TableCell>
              </TableRow>
            ) : (
              recentTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{transaction.primaryCategory}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{transaction.secondaryCategory}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
