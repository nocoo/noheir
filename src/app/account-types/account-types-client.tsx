import { Button, LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import { toast } from "@nocoo/basalt/components/toast";
import { CreditCard, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { useRevalidator } from "react-router";
import { saveAccountTypes } from "@/app/actions/settings-actions";
import { FinancialSnapshotNotice } from "@/components/shared/financial-snapshot-notice";
import { buildAccountTypesUpdate } from "@/domain/settings/account-types";
import type { AccountType, AccountTypeConfig } from "@/domain/types";

const TYPE_LABELS: Record<AccountType, { label: string; color: string }> = {
  debit: { label: "储蓄卡", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  credit: { label: "信用卡", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  prepaid: { label: "预付卡", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  financial: { label: "理财账户", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  unclassified: { label: "未分类", color: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
};

interface AccountTypesClientProps {
  accounts: string[];
  revision: number;
  accountTypes: AccountTypeConfig[];
  grouped: Record<AccountType, string[]>;
}

export function AccountTypesClient({
  accounts,
  accountTypes,
  grouped,
  revision,
}: AccountTypesClientProps) {
  const revalidator = useRevalidator();
  const [isPending, startTransition] = useTransition();
  const [types, setTypes] = useState<AccountTypeConfig[]>(accountTypes);
  const [baseRevision, setBaseRevision] = useState(revision);

  const getType = (accountName: string): AccountType => {
    const entry = types.find((t) => t.accountName === accountName);
    return entry?.type ?? "unclassified";
  };

  const handleChange = (accountName: string, type: AccountType) => {
    setTypes((prev) => buildAccountTypesUpdate(prev, accountName, type));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveAccountTypes(types, baseRevision);
      if (result.success) {
        toast.success("账户类型已保存");
        revalidator.revalidate();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <FinancialSnapshotNotice
        changed={baseRevision !== revision}
        onReset={() => {
          setTypes(accountTypes);
          setBaseRevision(revision);
        }}
      />
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CreditCard className="text-basalt-primary size-6" />
          账户类型管理
        </h1>
        <p className="text-basalt-muted-foreground text-sm">
          配置各账户的归类（储蓄卡、信用卡、理财等）
        </p>
      </div>

      {/* Grouped View */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.entries(TYPE_LABELS) as [AccountType, (typeof TYPE_LABELS)[AccountType]][]).map(
          ([typeKey, config]) => {
            const items = grouped[typeKey] ?? [];
            return (
              <LayerCard key={typeKey}>
                <LayerCard.Header className="items-stretch flex-col gap-1.5 pb-2">
                  <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
                    <Badge className={config.color}>{config.label}</Badge>
                    <span className="text-basalt-muted-foreground text-sm font-normal">
                      {items.length}个
                    </span>
                  </h3>
                </LayerCard.Header>
                <LayerCard.Body className="min-h-0 flex-1">
                  {items.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {items.map((name) => (
                        <Badge key={name} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-basalt-muted-foreground text-xs">无账户</p>
                  )}
                </LayerCard.Body>
              </LayerCard>
            );
          },
        )}
      </div>

      {/* Account Type Editor */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground text-base">
            账户类型编辑
          </h3>
          <p className="text-sm text-basalt-muted-foreground">为每个账户指定类型</p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="font-medium">{account}</span>
                <Select
                  value={getType(account)}
                  onValueChange={(v) => handleChange(account, v as AccountType)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TYPE_LABELS) as [AccountType, { label: string }][]).map(
                      ([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="text-basalt-muted-foreground py-4 text-center text-sm">暂无账户数据</p>
            )}
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </div>
  );
}
