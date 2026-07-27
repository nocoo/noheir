"use client";

/**
 * Three-column edit dialog for an existing capital unit (docs/003 § UI).
 *
 *   基础信息 | 产品 + 操作 | 历史时间线
 *
 * Metadata edits, staged operations and one shared audit note are submitted
 * together through POST /api/units/:id/commit, which applies them atomically.
 * Creation still uses the single-column UnitEditorForm.
 */

import { Info } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { commitUnit, listUnitContributionLogs } from "@/app/actions/contribution-log-actions";
import { InvestmentTimeline } from "@/components/capital/investment-timeline";
import { UnitLogTimeline } from "@/components/capital/unit-log-timeline";
import { UnitOperationsPanel } from "@/components/capital/unit-operations-panel";
import { SectionTitle } from "@/components/capital/unit-panel-primitives";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type {
  DomainContributionLog,
  DomainProduct,
  ExpectedUnitSnapshot,
  SerializedUnit,
} from "@/domain/types";
import {
  buildCommitPayload,
  formSnapshotFromExpected,
  isAmountLocked,
  isUnitCodeLocked,
  type StagedOperation,
  stageOperation,
  type UnitFormSnapshot,
  unstageOperation,
} from "@/lib/unit-commit-plan";

const STATUSES = ["已成立", "计划中", "筹集中", "已归档"];
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
];

interface UnitCommitDialogProps {
  unit: SerializedUnit;
  products: DomainProduct[];
  units: SerializedUnit[];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UnitCommitDialog({
  unit,
  products,
  units,
  onOpenChange,
  onSuccess,
}: UnitCommitDialogProps) {
  // Form values and the CAS anchor are derived from ONE snapshot, so the user
  // can never edit stale values that then pass the guard (docs/003 § Decision B).
  const [expected, setExpected] = useState<ExpectedUnitSnapshot | null>(null);
  const [initialForm, setInitialForm] = useState<UnitFormSnapshot | null>(null);

  const [unitCode, setUnitCode] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const [status, setStatus] = useState("已成立");
  const [strategy, setStrategy] = useState("");
  const [tactics, setTactics] = useState("");
  const [startDate, setStartDate] = useState("");
  const [unitNote, setUnitNote] = useState("");

  const [operations, setOperations] = useState<StagedOperation[]>([]);
  const [commitNote, setCommitNote] = useState("");
  const [operationDate, setOperationDate] = useState("");

  const [logs, setLogs] = useState<DomainContributionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const applySnapshot = useCallback((snapshot: ExpectedUnitSnapshot) => {
    const form = formSnapshotFromExpected(snapshot);
    setExpected(snapshot);
    setInitialForm(form);
    setUnitCode(form.unitCode);
    setAmount(String(form.amount));
    setCurrency(form.currency);
    setStatus(form.status);
    setStrategy(form.strategy);
    setTactics(form.tactics);
    setStartDate(form.startDate ?? "");
    setUnitNote(form.note ?? "");
  }, []);

  /** Initial load: seeds both the anchor and the form. */
  const loadAll = useCallback(async () => {
    setLoading(true);
    const result = await listUnitContributionLogs(unit.id);
    if (result.success) {
      setLogs(result.data.logs);
      applySnapshot(result.data.expected);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [unit.id, applySnapshot]);

  /**
   * Refresh after an inline pnl edit. Deliberately does NOT touch `expected`:
   * editing a contribution log leaves capital_units untouched, so re-anchoring
   * would silently adopt any concurrent unit change the user hasn't seen.
   */
  const refreshLogs = useCallback(async () => {
    const result = await listUnitContributionLogs(unit.id);
    if (result.success) {
      setLogs(result.data.logs);
    } else {
      toast.error(result.error);
    }
  }, [unit.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const codeLocked = isUnitCodeLocked(operations);
  const amountLocked = isAmountLocked(operations);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!expected || !initialForm) {
      toast.error("单元数据尚未加载完成");
      return;
    }
    if (!unitCode.trim()) {
      toast.error("请输入单位编号");
      return;
    }
    if (!amount || Number(amount) < 0) {
      toast.error("请输入有效金额");
      return;
    }

    const payload = buildCommitPayload({
      expected,
      initial: initialForm,
      current: {
        unitCode: unitCode.trim(),
        amount: Number(amount),
        currency,
        status,
        strategy,
        tactics,
        startDate: startDate || null,
        note: unitNote.trim() || null,
      },
      operations,
      commitNote,
      operationDate: operationDate || null,
    });

    if (!payload) {
      toast.info("没有需要保存的变更");
      return;
    }

    startTransition(async () => {
      const result = await commitUnit(unit.id, payload);
      if (result.success) {
        toast.success("已保存");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const selectedProduct = products.find((p) => p.id === expected?.productId) ?? null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>编辑资本单位 · {unit.unitCode}</DialogTitle>
        <DialogDescription>
          修改基础信息、执行操作，并为本次变更留下一条备注。保存时一并生效。
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nothing is editable until the snapshot lands: every field and the
            operations panel are anchored to it, so acting earlier would mean
            acting on data the guard will not compare. */}
        <fieldset disabled={loading} className="space-y-4 disabled:opacity-60">
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            {/* ── Column 1: basic info — the tallest by nature, so it sets the
                band height the other two columns fill. ── */}
            <div className="space-y-4">
              <SectionTitle icon={<Info className="size-3" />} label="基础信息" />

              <div className="space-y-1.5">
                <Label htmlFor="unitCode" className="text-xs">
                  编号
                </Label>
                <Input
                  id="unitCode"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  className="h-9"
                  disabled={codeLocked}
                />
                {codeLocked && (
                  <p className="text-muted-foreground text-[10px]">已暂存番号对换，编号不可手改</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-xs">
                  金额
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-9"
                  disabled={amountLocked}
                />
                {amountLocked && (
                  <p className="text-muted-foreground text-[10px]">
                    已暂存产品切换，金额不可同时改
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">币种</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-9" aria-label="币种">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNY">CNY</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="HKD">HKD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">状态</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-9" aria-label="状态">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">策略</Label>
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger className="h-9" aria-label="策略">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">战术</Label>
                <Select value={tactics} onValueChange={setTactics}>
                  <SelectTrigger className="h-9" aria-label="战术">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TACTICS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs">
                  开始日期
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unitNote" className="text-xs">
                  单元备注
                </Label>
                <Textarea
                  id="unitNote"
                  value={unitNote}
                  onChange={(e) => setUnitNote(e.target.value)}
                  placeholder="长期保留的说明"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            {/* ── Column 2: product + operations ── */}
            <div className="space-y-4">
              <UnitOperationsPanel
                unitId={unit.id}
                currentProductId={expected?.productId ?? null}
                units={units}
                products={products}
                operations={operations}
                onStage={(op) => setOperations((prev) => stageOperation(prev, op))}
                onUnstage={(kind) => setOperations((prev) => unstageOperation(prev, kind))}
              />

              {selectedProduct &&
                unit.latestInvestDate &&
                selectedProduct.lockPeriodDays != null &&
                selectedProduct.lockPeriodDays > 0 && (
                  <div className="space-y-2">
                    <SectionTitle icon={<Info className="size-3" />} label="投资时间线" />
                    <InvestmentTimeline
                      latestInvestDate={unit.latestInvestDate}
                      lockPeriodDays={selectedProduct.lockPeriodDays}
                      openDays={selectedProduct.openDays}
                      cycleDays={selectedProduct.cycleDays}
                    />
                  </div>
                )}
            </div>

            {/* ── Column 3: history ──
                Absolutely positioned inside a relative cell so its content
                cannot grow the row: it fills exactly what column 1 established
                and scrolls beyond that. */}
            <div className="relative">
              <div className="lg:absolute lg:inset-0">
                <UnitLogTimeline logs={logs} loading={loading} onRefresh={refreshLogs} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="commitNote" className="text-xs">
                本次变更备注
              </Label>
              <Input
                id="commitNote"
                value={commitNote}
                onChange={(e) => setCommitNote(e.target.value)}
                placeholder="为什么做这次变更（会写入日志）"
                className="h-9"
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-44">
              <Label htmlFor="operationDate" className="text-xs">
                操作日期
              </Label>
              <Input
                id="operationDate"
                type="date"
                value={operationDate}
                onChange={(e) => setOperationDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button type="submit" disabled={isPending || !expected || loading}>
            {isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </>
  );
}
