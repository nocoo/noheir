import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/types/transaction';

export interface TopTransactionsTableProps {
  title: string;
  description: string;
  transactions: Transaction[];
  variant: 'income' | 'expense';
  colorClass: string;
}

export function TopTransactionsTable({
  title,
  description,
  transactions,
  variant,
  colorClass,
}: TopTransactionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">排名</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>一级分类</TableHead>
              <TableHead>二级分类</TableHead>
              <TableHead>三级分类</TableHead>
              <TableHead>账户</TableHead>
              <TableHead>备注</TableHead>
              <TableHead className="text-right">金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t, index) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {index < 3 && (
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {index + 1}
                    </span>
                  )}
                  {index >= 3 && <span className="text-muted-foreground">#{index + 1}</span>}
                </TableCell>
                <TableCell className="text-sm">{t.date}</TableCell>
                <TableCell>{t.primaryCategory}</TableCell>
                <TableCell className="text-muted-foreground">{t.secondaryCategory}</TableCell>
                <TableCell className="text-muted-foreground">{t.tertiaryCategory}</TableCell>
                <TableCell className="text-muted-foreground">{t.account}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{t.description || '-'}</TableCell>
                <TableCell className={`text-right font-semibold ${colorClass}`}>
                  ¥{t.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
