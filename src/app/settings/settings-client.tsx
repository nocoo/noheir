"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, Save, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { clampSavingsRate, getSavingsRateTone } from "@/domain/settings/savings-rate";
import {
  clampMinReturnRate,
  clampMaxReturnRate,
  DEFAULT_MIN_RETURN_RATE,
  DEFAULT_MAX_RETURN_RATE,
} from "@/domain/settings/return-rate";
import { saveGeneralSettings, saveReturnRateSettings } from "@/app/actions/settings-actions";
import { cn } from "@/lib/utils";

interface SettingsClientProps {
  settingsJson: Record<string, unknown>;
}

export function SettingsClient({ settingsJson }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Savings rate settings
  const [savingsTarget, setSavingsTarget] = useState(
    Number(settingsJson.savings_rate_target ?? 30),
  );

  // Return rate settings
  const [minReturnRate, setMinReturnRate] = useState(
    Number(settingsJson.min_return_rate ?? DEFAULT_MIN_RETURN_RATE),
  );
  const [maxReturnRate, setMaxReturnRate] = useState(
    Number(settingsJson.max_return_rate ?? DEFAULT_MAX_RETURN_RATE),
  );

  const savingsRateTone = getSavingsRateTone(savingsTarget);

  const handleSave = () => {
    startTransition(async () => {
      // Save all settings in parallel
      const [generalResult, returnRateResult] = await Promise.all([
        saveGeneralSettings({
          savingsRateTarget: savingsTarget,
          expectedReturnRate: maxReturnRate,
        }),
        saveReturnRateSettings({ minReturnRate, maxReturnRate }),
      ]);

      if (generalResult.success && returnRateResult.success) {
        toast.success("设置已保存");
        router.refresh();
      } else {
        const errorMsg = !generalResult.success
          ? generalResult.error
          : !returnRateResult.success
            ? returnRateResult.error
            : "未知错误";
        toast.error(errorMsg);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="text-primary size-6" />
          系统设置
        </h1>
        <p className="text-muted-foreground text-sm">应用偏好与配置</p>
      </div>

      {/* Savings Rate Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4" />
            目标储蓄率
          </CardTitle>
          <CardDescription>设置每月的储蓄目标比例</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>目标储蓄率</Label>
              <span className="text-primary text-2xl font-bold">{savingsTarget}%</span>
            </div>
            <Slider
              value={[savingsTarget]}
              onValueChange={([v]: number[]) => setSavingsTarget(clampSavingsRate(v ?? 0))}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            建议储蓄率在 30%-70% 之间，当前设置：
            <span
              className={cn(
                "ml-1 font-semibold",
                savingsRateTone === "high"
                  ? "text-income"
                  : savingsRateTone === "ok"
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-expense",
              )}
            >
              {savingsRateTone === "low" ? "偏低" : savingsRateTone === "high" ? "偏高" : "合理"}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Return Rate Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" />
            收益率范围
          </CardTitle>
          <CardDescription>
            设置理财产品收益率的合理范围，用于识别过低或过高的收益率
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Min Return Rate */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>保底收益率 (%)</Label>
              <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                {minReturnRate.toFixed(2)}%
              </span>
            </div>
            <Slider
              min={0}
              max={10}
              step={0.05}
              value={[minReturnRate]}
              onValueChange={([v]: number[]) => setMinReturnRate(clampMinReturnRate(v ?? 0))}
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>0%</span>
              <span>低于此值显示为黄色警告</span>
              <span>10%</span>
            </div>
          </div>

          {/* Max Return Rate */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>风险收益率阈值 (%)</Label>
              <span className="text-rose-600 dark:text-rose-400 text-sm font-medium">
                {maxReturnRate.toFixed(2)}%
              </span>
            </div>
            <Slider
              min={0}
              max={15}
              step={0.1}
              value={[maxReturnRate]}
              onValueChange={([v]: number[]) => setMaxReturnRate(clampMaxReturnRate(v ?? 0))}
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>0%</span>
              <span>高于此值显示为红色风险</span>
              <span>15%</span>
            </div>
          </div>

          {/* Visual Range Display */}
          <div className="bg-muted/50 mt-6 space-y-3 rounded-lg p-4">
            <p className="text-sm font-medium">收益率范围可视化:</p>
            <div className="relative h-8 overflow-hidden rounded-md bg-gradient-to-r from-amber-200 via-emerald-200 to-rose-200 dark:from-amber-900/30 dark:via-emerald-900/30 dark:to-rose-900/30">
              {/* Min marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-600 dark:bg-amber-400"
                style={{ left: `${(minReturnRate / 15) * 100}%` }}
              >
                <div className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-amber-600 dark:bg-amber-400" />
              </div>
              {/* Max marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-rose-600 dark:bg-rose-400"
                style={{ left: `${(maxReturnRate / 15) * 100}%` }}
              >
                <div className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-rose-600 dark:bg-rose-400" />
              </div>
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>0%</span>
              <span>15%</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                <span>过低: &lt;{minReturnRate.toFixed(2)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                <span>
                  正常: {minReturnRate.toFixed(2)}% - {maxReturnRate.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-rose-600 dark:bg-rose-400" />
                <span>风险: &gt;{maxReturnRate.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
