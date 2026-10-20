import { LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nocoo/basalt/components/table";
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
      <LayerCard>
        <LayerCard.Body className="min-h-0 flex-1 py-12 text-center">
          <p className="text-basalt-muted-foreground">暂无交易记录，请导入数据</p>
        </LayerCard.Body>
      </LayerCard>
    );
  }

  return (
    <LayerCard>
      <LayerCard.Header className="items-stretch flex-col gap-1.5">
        <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2">
          <Icon className="text-basalt-primary size-5" />
          最近交易记录
        </h3>
      </LayerCard.Header>
      <LayerCard.Body className="min-h-0 flex-1">
        <div className="relative w-full overflow-x-auto">
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
                          className={cn(
                            secondaryColor.bg,
                            secondaryColor.text,
                            "border-transparent",
                          )}
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
                    <TableCell className="text-basalt-muted-foreground hidden xl:table-cell">
                      {t.account}
                    </TableCell>
                    <TableCell className="text-basalt-muted-foreground max-w-[200px] truncate text-sm">
                      {t.note ?? "-"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        isIncome
                          ? "text-income dark:text-income"
                          : "text-expense dark:text-expense",
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
        </div>
      </LayerCard.Body>
    </LayerCard>
  );
}
