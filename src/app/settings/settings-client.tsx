import { Button, Field, Input, Label, LayerCard } from "@nocoo/basalt";
import { Slider } from "@nocoo/basalt/components/slider";
import { toast } from "@nocoo/basalt/components/toast";
import { Save, Settings, Target, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";
import { Link, useRevalidator } from "react-router";
import { saveFinancialPreferences } from "@/app/actions/settings-actions";
import { FinancialSnapshotNotice } from "@/components/shared/financial-snapshot-notice";
import type { FinancialPreferences } from "@/domain/api-contract";
import { clampMaxReturnRate, clampMinReturnRate } from "@/domain/settings/return-rate";
import { clampSavingsRate, getSavingsRateTone } from "@/domain/settings/savings-rate";
import { cn } from "@/lib/utils";

interface SettingsClientProps {
  preferences: FinancialPreferences;
}

export function SettingsClient({ preferences }: SettingsClientProps) {
  const revalidator = useRevalidator();
  const [isPending, startTransition] = useTransition();
  const [baseVersion, setBaseVersion] = useState(preferences.version);

  // Savings rate settings
  const [savingsTarget, setSavingsTarget] = useState(preferences.savingsRateTarget);

  // Return rate settings
  const [minReturnRate, setMinReturnRate] = useState(preferences.minReturnRate);
  const [maxReturnRate, setMaxReturnRate] = useState(preferences.maxReturnRate);

  const [expectedReturnRate, setExpectedReturnRate] = useState(preferences.expectedReturnRate);

  const savingsRateTone = getSavingsRateTone(savingsTarget);

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveFinancialPreferences(
        {
          savingsRateTarget: savingsTarget,
          expectedReturnRate,
          minReturnRate,
          maxReturnRate,
        },
        baseVersion,
      );
      if (result.success) {
        toast.success("设置已保存");
        revalidator.revalidate();
      } else toast.error(result.error);
    });
  };

  return (
    <div className="space-y-6">
      <FinancialSnapshotNotice
        changed={baseVersion !== preferences.version}
        onReset={() => {
          setSavingsTarget(preferences.savingsRateTarget);
          setExpectedReturnRate(preferences.expectedReturnRate);
          setMinReturnRate(preferences.minReturnRate);
          setMaxReturnRate(preferences.maxReturnRate);
          setBaseVersion(preferences.version);
        }}
      />
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="text-basalt-primary size-6" />
          财务假设
        </h1>
        <p className="text-basalt-muted-foreground text-sm">
          储蓄目标、收益率假设与收支分类；不包含身份、外观或密钥管理。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/category-settings">收支分类</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/account-types">账户分类</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/balance-anchors">余额锚点</Link>
        </Button>
      </div>
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground text-base">
            预期年化收益率
          </h3>
          <p className="text-sm text-basalt-muted-foreground">财务规划假设，不代表投资承诺。</p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <Field label="预期年化收益率 (%)" htmlFor="expected-return">
            <Input
              id="expected-return"
              type="number"
              min={-100}
              max={100}
              step={0.1}
              value={expectedReturnRate}
              onChange={(event) => setExpectedReturnRate(event.target.valueAsNumber)}
            />
          </Field>
        </LayerCard.Body>
      </LayerCard>
      {/* Savings Rate Settings */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
            <Target className="size-4" />
            目标储蓄率
          </h3>
          <p className="text-sm text-basalt-muted-foreground">设置每月的储蓄目标比例</p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>目标储蓄率</Label>
              <span className="text-basalt-primary text-2xl font-bold">{savingsTarget}%</span>
            </div>
            <Slider
              value={[savingsTarget]}
              onValueChange={([v]: number[]) => setSavingsTarget(clampSavingsRate(v ?? 0))}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="text-basalt-muted-foreground flex justify-between text-xs">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          <p className="text-basalt-muted-foreground text-sm">
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
        </LayerCard.Body>
      </LayerCard>

      {/* Return Rate Settings */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
            <TrendingUp className="size-4" />
            收益率范围
          </h3>
          <p className="text-sm text-basalt-muted-foreground">
            设置理财产品收益率的合理范围，用于识别过低或过高的收益率
          </p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1 space-y-6">
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
            <div className="text-basalt-muted-foreground flex justify-between text-xs">
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
            <div className="text-basalt-muted-foreground flex justify-between text-xs">
              <span>0%</span>
              <span>高于此值显示为红色风险</span>
              <span>15%</span>
            </div>
          </div>

          {/* Visual Range Display */}
          <div className="mt-6 space-y-3 rounded-lg p-4">
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
            <div className="text-basalt-muted-foreground flex justify-between text-xs">
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
        </LayerCard.Body>
      </LayerCard>

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
