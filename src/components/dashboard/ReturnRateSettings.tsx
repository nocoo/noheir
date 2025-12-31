import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useSettings } from '@/contexts/SettingsContext';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export function ReturnRateSettings() {
  const { settings, updateMinReturnRate, updateMaxReturnRate } = useSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          收益率范围
        </CardTitle>
        <CardDescription>
          设置理财产品收益率的合理范围,用于识别过低或过高的收益率
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Min Return Rate */}
        <div className="space-y-3">
          <Label htmlFor="minReturnRate" className="flex items-center justify-between">
            <span>保底收益率 (%)</span>
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {settings.minReturnRate.toFixed(2)}%
            </span>
          </Label>
          <Slider
            id="minReturnRate"
            min={0}
            max={10}
            step={0.05}
            value={[settings.minReturnRate]}
            onValueChange={(value) => updateMinReturnRate(value[0])}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>低于此值显示为黄色警告</span>
            <span>10%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 收益率低于此值可能意味着资金利用效率低,存在浪费
          </p>
        </div>

        {/* Max Return Rate */}
        <div className="space-y-3">
          <Label htmlFor="maxReturnRate" className="flex items-center justify-between">
            <span>风险收益率阈值 (%)</span>
            <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
              {settings.maxReturnRate.toFixed(2)}%
            </span>
          </Label>
          <Slider
            id="maxReturnRate"
            min={0}
            max={15}
            step={0.1}
            value={[settings.maxReturnRate]}
            onValueChange={(value) => updateMaxReturnRate(value[0])}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>高于此值显示为红色风险</span>
            <span>15%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            收益率高于此值可能意味着高风险投资,需谨慎评估
          </p>
        </div>

        {/* Visual Range Display */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
          <p className="text-sm font-medium">收益率范围可视化:</p>
          <div className="relative h-8 bg-gradient-to-r from-amber-200 via-emerald-200 to-rose-200 dark:from-amber-900/30 dark:via-emerald-900/30 dark:to-rose-900/30 rounded-md overflow-hidden">
            {/* Min marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-600 dark:bg-amber-400"
              style={{ left: `${(settings.minReturnRate / 15) * 100}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-600 dark:bg-amber-400 rounded-full" />
            </div>
            {/* Max marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-600 dark:bg-rose-400"
              style={{ left: `${(settings.maxReturnRate / 15) * 100}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-rose-600 dark:bg-rose-400 rounded-full" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>15%</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400" />
              <span>过低: &lt;{settings.minReturnRate.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span>正常: {settings.minReturnRate.toFixed(2)}% - {settings.maxReturnRate.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-400" />
              <span>风险: &gt;{settings.maxReturnRate.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
