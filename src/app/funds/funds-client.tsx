import { Button, LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import { Input } from "@nocoo/basalt/components/input";
import { Label } from "@nocoo/basalt/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSortableHeader,
} from "@nocoo/basalt/components/table";
import { toast } from "@nocoo/basalt/components/toast";
import { Filter, Landmark, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRevalidator } from "react-router";
import { deleteUnit } from "@/app/actions/unit-actions";
import { type SerializedUnit, UnitEditor } from "@/components/capital/unit-editor";
import {
  CurrencyBadge,
  StatusBadge,
  StrategyBadge,
  TacticsBadge,
  UnitCodeBadge,
} from "@/components/ui/colored-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { sumCurrency } from "@/domain/currency-summary";
import type { DomainProduct } from "@/domain/types";
import { formatCurrencyFull } from "@/lib/chart-config";
import { CAPITAL_TABLE_COLUMNS } from "@/lib/table-columns";
import { cn } from "@/lib/utils";

interface FundsClientProps {
  units: SerializedUnit[];
  products: DomainProduct[];
}

const STRATEGIES = [
  "远期理财",
  "美元资产",
  "36存单",
  "长期理财",
  "短期理财",
  "中期理财",
  "进攻计划",
  "麻麻理财",
];

const TACTICS = [
  "养老年金",
  "个人养老金",
  "定期存款",
  "理财产品",
  "现金产品",
  "债券基金",
  "偏股基金",
  "稳健理财",
  "增额寿险",
  "货币基金",
  // Present in production data before the enum existed (B25/B26, E01).
  "混债基金",
  "现金管理",
];

const STATUSES = ["已成立", "计划中", "筹集中", "已归档"];

type SortField = "unitCode" | "amount" | "availableDate" | "status" | "strategy";
type SortDir = "asc" | "desc";

export function FundsClient({ units, products }: FundsClientProps) {
  const revalidator = useRevalidator();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<SerializedUnit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedUnit | null>(null);
  const [sortField, setSortField] = useState<SortField>("unitCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStrategy, setFilterStrategy] = useState("all");
  const [filterTactics, setFilterTactics] = useState("all");

  const activeFilterCount = [filterStatus, filterStrategy, filterTactics].filter(
    (f) => f !== "all",
  ).length;

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterStrategy("all");
    setFilterTactics("all");
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getAriaSort = (field: SortField): "ascending" | "descending" | "none" => {
    if (sortField !== field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  const filteredAndSorted = useMemo(() => {
    // First filter
    const result = units.filter((u) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matches =
          u.unitCode.toLowerCase().includes(q) ||
          u.strategy.includes(search) ||
          u.tactics.includes(search) ||
          (u.productName ?? "").includes(search) ||
          (u.note ?? "").includes(search);
        if (!matches) return false;
      }
      // Status filter
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      // Strategy filter
      if (filterStrategy !== "all" && u.strategy !== filterStrategy) return false;
      // Tactics filter
      if (filterTactics !== "all" && u.tactics !== filterTactics) return false;
      return true;
    });

    // Then sort
    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "amount":
          return (a.amount - b.amount) * dir;
        case "availableDate":
          return ((a.availableDate ?? "9999") > (b.availableDate ?? "9999") ? 1 : -1) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "strategy":
          return a.strategy.localeCompare(b.strategy, "zh-CN") * dir;
        default:
          return a.unitCode.localeCompare(b.unitCode) * dir;
      }
    });

    return result;
  }, [units, search, filterStatus, filterStrategy, filterTactics, sortField, sortDir]);

  const totalAmount = sumCurrency(filteredAndSorted);

  const handleEdit = (unit: SerializedUnit) => {
    setEditingUnit(unit);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUnit(null);
    setDialogOpen(true);
  };

  const handleDelete = (unit: SerializedUnit) => {
    setDeleteTarget(unit);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteUnit(deleteTarget.id, deleteTarget.version);
      if (result.success) {
        toast.success("资本单位已删除");
        revalidator.revalidate();
      } else {
        toast.error(result.error);
      }
      setDeleteTarget(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Landmark className="text-basalt-primary size-6" />
            资本单位管理
          </h1>
          <p className="text-basalt-muted-foreground text-sm">
            ({filteredAndSorted.length} / {units.length} 个单位) · CNY 总计{" "}
            {formatCurrencyFull(totalAmount)}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="text-basalt-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="搜索单位..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 sm:w-[200px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={showFilters}
            className="shrink-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-1 size-4" />
            筛选
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button onClick={handleCreate} size="sm" className="shrink-0">
            <Plus className="mr-1 size-4" />
            新增
          </Button>
        </div>
      </div>

      {/* Unit Editor Dialog */}
      <UnitEditor
        unit={editingUnit}
        products={products}
        units={units}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => revalidator.revalidate()}
      />

      {/* Filter Panel */}
      {showFilters && (
        <div className="space-y-4 rounded-lg border bg-basalt-muted/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">筛选条件</h3>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 size-4" />
              重置
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-basalt-muted-foreground text-xs">状态</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strategy Filter */}
            <div className="space-y-1.5">
              <Label className="text-basalt-muted-foreground text-xs">策略</Label>
              <Select value={filterStrategy} onValueChange={setFilterStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部策略</SelectItem>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tactics Filter */}
            <div className="space-y-1.5">
              <Label className="text-basalt-muted-foreground text-xs">战术</Label>
              <Select value={filterTactics} onValueChange={setFilterTactics}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部战术</SelectItem>
                  {TACTICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Units Table */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground text-base">
            单位列表
          </h3>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <div className="relative w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className={CAPITAL_TABLE_COLUMNS.unitCode}
                    aria-sort={getAriaSort("unitCode")}
                  >
                    <TableSortableHeader
                      {...(sortField === "unitCode" ? { sorted: sortDir } : {})}
                      onClick={() => toggleSort("unitCode")}
                    >
                      编号
                    </TableSortableHeader>
                  </TableHead>
                  <TableHead
                    className={CAPITAL_TABLE_COLUMNS.amount}
                    aria-sort={getAriaSort("amount")}
                  >
                    <TableSortableHeader
                      {...(sortField === "amount" ? { sorted: sortDir } : {})}
                      textAlign="end"
                      onClick={() => toggleSort("amount")}
                    >
                      金额
                    </TableSortableHeader>
                  </TableHead>
                  <TableHead
                    className={CAPITAL_TABLE_COLUMNS.strategy}
                    aria-sort={getAriaSort("strategy")}
                  >
                    <TableSortableHeader
                      {...(sortField === "strategy" ? { sorted: sortDir } : {})}
                      onClick={() => toggleSort("strategy")}
                    >
                      策略
                    </TableSortableHeader>
                  </TableHead>
                  <TableHead className={CAPITAL_TABLE_COLUMNS.tactics}>战术</TableHead>
                  <TableHead className={CAPITAL_TABLE_COLUMNS.product}>产品</TableHead>
                  <TableHead
                    className={CAPITAL_TABLE_COLUMNS.status}
                    aria-sort={getAriaSort("status")}
                  >
                    <TableSortableHeader
                      {...(sortField === "status" ? { sorted: sortDir } : {})}
                      onClick={() => toggleSort("status")}
                    >
                      状态
                    </TableSortableHeader>
                  </TableHead>
                  <TableHead
                    className={CAPITAL_TABLE_COLUMNS.date}
                    aria-sort={getAriaSort("availableDate")}
                  >
                    <TableSortableHeader
                      {...(sortField === "availableDate" ? { sorted: sortDir } : {})}
                      onClick={() => toggleSort("availableDate")}
                    >
                      可用日期
                    </TableSortableHeader>
                  </TableHead>
                  <TableHead className={CAPITAL_TABLE_COLUMNS.actions}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <UnitCodeBadge unitCode={unit.unitCode} />
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrencyFull(unit.amount)}{" "}
                      <CurrencyBadge
                        currency={unit.currency}
                        className="ml-1 text-xs font-normal"
                      />
                    </TableCell>
                    <TableCell>
                      <StrategyBadge strategy={unit.strategy} />
                    </TableCell>
                    <TableCell>
                      <TacticsBadge tactics={unit.tactics} />
                    </TableCell>
                    <TableCell className="text-basalt-muted-foreground text-xs">
                      {unit.productName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={unit.status} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          unit.isAvailable
                            ? "text-green-600 dark:text-green-400"
                            : unit.daysUntilAvailable != null && unit.daysUntilAvailable <= 30
                              ? "text-amber-600 dark:text-amber-400"
                              : unit.daysUntilAvailable != null
                                ? "text-basalt-destructive"
                                : "text-basalt-muted-foreground",
                        )}
                      >
                        {unit.availableDate ?? "—"}
                        {unit.daysUntilAvailable != null && (
                          <span className="ml-1 text-xs">
                            (
                            {unit.isAvailable
                              ? "可用"
                              : unit.daysUntilAvailable <= 30
                                ? `${unit.daysUntilAvailable}天`
                                : "锁定中"}
                            )
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`编辑 ${unit.unitCode}`}
                          onClick={() => handleEdit(unit)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-basalt-destructive"
                          aria-label={`删除 ${unit.unitCode}`}
                          onClick={() => handleDelete(unit)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSorted.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-basalt-muted-foreground py-8 text-center"
                    >
                      {search || activeFilterCount > 0 ? "未找到匹配的单位" : "暂无资本单位"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除资本单位"
        description={`确定要删除单位「${deleteTarget?.unitCode ?? ""}」吗？此操作不可撤销。`}
        onConfirm={confirmDelete}
        loading={isPending}
      />
    </div>
  );
}
