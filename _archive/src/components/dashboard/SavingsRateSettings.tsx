import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSavingsRateSettingsViewModel } from '@/viewmodels/settings/useSavingsRateSettingsViewModel';

export function SavingsRateSettings() {
  const {
    isVisible,
    loading,
    targetSavingsRate,
    rateTone,
    handleRateChange,
  } = useSavingsRateSettingsViewModel();

  if (!isVisible) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          目标储蓄率
        </CardTitle>
        <CardDescription>设置每月的储蓄目标比例</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>目标储蓄率</Label>
            <span className="text-2xl font-bold text-primary">
              {targetSavingsRate}%
            </span>
          </div>
          <Slider
            value={[targetSavingsRate]}
            onValueChange={(value) => handleRateChange(value[0])}
            min={0}
            max={100}
            step={5}
            disabled={loading}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          建议储蓄率在 30%-70% 之间，当前设置：
          <span
            className={cn(
              'ml-1 font-semibold',
              rateTone === 'high'
                ? 'text-income'
                : rateTone === 'ok'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-expense'
            )}
          >
            {rateTone === 'low'
              ? '偏低'
              : rateTone === 'high'
                ? '偏高'
                : '合理'}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
