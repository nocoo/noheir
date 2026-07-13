"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountType, AccountTypeConfig } from "@/domain/types";
import { buildAccountTypesUpdate } from "@/domain/settings/account-types";
import { saveAccountTypes } from "@/app/actions/settings-actions";

const TYPE_LABELS: Record<AccountType, { label: string; color: string }> = {
  debit: { label: "储蓄卡", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  credit: { label: "信用卡", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  prepaid: { label: "预付卡", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  financial: { label: "理财账户", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  unclassified: { label: "未分类", color: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
};

interface AccountTypesClientProps {
  accounts: string[];
  accountTypes: AccountTypeConfig[];
  grouped: Record<AccountType, string[]>;
}

export function AccountTypesClient({ accounts, accountTypes, grouped }: AccountTypesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [types, setTypes] = useState<AccountTypeConfig[]>(accountTypes);

  const getType = (accountName: string): AccountType => {
    const entry = types.find((t) => t.accountName === accountName);
    return entry?.type ?? "unclassified";
  };

  const handleChange = (accountName: string, type: AccountType) => {
    setTypes((prev) => buildAccountTypesUpdate(prev, accountName, type));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveAccountTypes(types);
      if (result.success) {
        toast.success("账户类型已保存");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CreditCard className="text-primary size-6" />
          账户类型管理
        </h1>
        <p className="text-muted-foreground text-sm">配置各账户的归类（储蓄卡、信用卡、理财等）</p>
      </div>

      {/* Grouped View */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.entries(TYPE_LABELS) as [AccountType, (typeof TYPE_LABELS)[AccountType]][]).map(
          ([typeKey, config]) => {
            const items = grouped[typeKey] ?? [];
            return (
              <Card key={typeKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge className={config.color}>{config.label}</Badge>
                    <span className="text-muted-foreground text-sm font-normal">
                      {items.length}个
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {items.map((name) => (
                        <Badge key={name} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">无账户</p>
                  )}
                </CardContent>
              </Card>
            );
          },
        )}
      </div>

      {/* Account Type Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账户类型编辑</CardTitle>
          <CardDescription>为每个账户指定类型</CardDescription>
        </CardHeader>
        <CardContent>
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
              <p className="text-muted-foreground py-4 text-center text-sm">暂无账户数据</p>
            )}
          </div>
        </CardContent>
      </Card>

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
