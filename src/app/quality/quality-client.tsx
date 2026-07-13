"use client";

import { Shield, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QualityClientProps {
  metadata: {
    transactionCount: number;
    transferCount: number;
    years: number[];
    accounts: number;
    categories: number;
    currencies: string[];
    tags: string[];
  };
}

interface QualityCheck {
  label: string;
  status: "pass" | "warn" | "info";
  detail: string;
}

export function QualityClient({ metadata }: QualityClientProps) {
  const checks: QualityCheck[] = [
    {
      label: "交易记录",
      status: metadata.transactionCount > 0 ? "pass" : "warn",
      detail: `${metadata.transactionCount} 条记录`,
    },
    {
      label: "转账记录",
      status: metadata.transferCount > 0 ? "pass" : "info",
      detail: `${metadata.transferCount} 条记录`,
    },
    {
      label: "数据年份覆盖",
      status: metadata.years.length >= 2 ? "pass" : "info",
      detail: metadata.years.length > 0 ? `${metadata.years.join(", ")}` : "无年份数据",
    },
    {
      label: "账户多样性",
      status: metadata.accounts >= 3 ? "pass" : metadata.accounts >= 1 ? "info" : "warn",
      detail: `${metadata.accounts} 个账户`,
    },
    {
      label: "分类覆盖",
      status: metadata.categories >= 5 ? "pass" : metadata.categories >= 1 ? "info" : "warn",
      detail: `${metadata.categories} 个分类`,
    },
    {
      label: "币种",
      status: "info",
      detail: metadata.currencies.length > 0 ? metadata.currencies.join(", ") : "无数据",
    },
    {
      label: "标签使用",
      status: metadata.tags.length >= 3 ? "pass" : "info",
      detail: `${metadata.tags.length} 个标签`,
    },
  ];

  const passCount = checks.filter((c) => c.status === "pass").length;
  const score = Math.round((passCount / checks.length) * 100);

  const statusIcon = (status: QualityCheck["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="size-4 text-emerald-500" />;
      case "warn":
        return <AlertTriangle className="size-4 text-amber-500" />;
      case "info":
        return <Info className="size-4 text-blue-500" />;
    }
  };

  const statusBadge = (status: QualityCheck["status"]) => {
    const map = {
      pass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    };
    const labels = { pass: "良好", warn: "注意", info: "信息" };
    return <Badge className={map[status] ?? ""}>{labels[status]}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="text-primary size-6" />
          数据质量
        </h1>
        <p className="text-muted-foreground text-sm">检查数据完整性与质量指标</p>
      </div>

      {/* Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">质量评分</CardTitle>
          <CardDescription>基于数据完整度的综合评分</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{score}%</div>
            <Progress value={score} className="flex-1" />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {passCount}/{checks.length} 项检查通过
          </p>
        </CardContent>
      </Card>

      {/* Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">检查项目</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checks.map((check) => (
              <div
                key={check.label}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  {statusIcon(check.status)}
                  <span className="text-sm font-medium">{check.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{check.detail}</span>
                  {statusBadge(check.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
