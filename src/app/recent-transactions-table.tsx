import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DomainTransaction } from "@/domain/types";
import { formatCurrencyFull } from "@/lib/chart-config";
import { getLabelColorClasses } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

interface RecentTransactionsTableProps {
  transactions: DomainTransaction[];
  icon: React.ElementType;
}

export function RecentTransactionsTable({
  transactions,
  icon: Icon,
}: RecentTransactionsTableProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">暂无交易记录，请导入数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="text-primary size-5" />
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
              <TableHead className="hidden xl:table-cell">账户</TableHead>
              <TableHead>备注</TableHead>
              <TableHead className="text-right">金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const primaryColor = getLabelColorClasses(t.primaryCategory);
              const secondaryColor = getLabelColorClasses(t.secondaryCategory ?? "");
              const tertiaryColor = getLabelColorClasses(t.tertiaryCategory);
              const isIncome = t.type === "income";

              return (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{t.date}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(primaryColor.bg, primaryColor.text, "border-transparent")}
                    >
                      {t.primaryCategory}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {t.secondaryCategory && (
                      <Badge
                        variant="outline"
                        className={cn(secondaryColor.bg, secondaryColor.text, "border-transparent")}
                      >
                        {t.secondaryCategory}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(tertiaryColor.bg, tertiaryColor.text, "border-transparent")}
                    >
                      {t.tertiaryCategory}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden xl:table-cell">
                    {t.account}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                    {t.note ?? "-"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      isIncome ? "text-income dark:text-income" : "text-expense dark:text-expense",
                    )}
                  >
                    {isIncome ? "+" : "-"}
                    {formatCurrencyFull(t.amount)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
