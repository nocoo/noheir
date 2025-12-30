import { useCallback, useRef } from 'react';
import { useSiteMetadata } from '@/hooks/useSiteMetadata';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function SavingsRateSettings() {
  const { user } = useAuth();
  const { data, loading, updateSingleSetting } = useSiteMetadata();
  const { settings: contextSettings, updateTargetSavingsRate } = useSettings();

  // Debounce ref for slider - must be before any conditional returns
  const rateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dbSettings = data?.settings;

  // Debounced database update for savings rate
  const debouncedUpdateRate = useCallback((value: number) => {
    if (rateTimeoutRef.current) {
      clearTimeout(rateTimeoutRef.current);
    }
    rateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateSingleSetting('targetSavingsRate', value);
      } catch (err) {
        console.error('Failed to update savings rate:', err);
      }
    }, 1000);
  }, [updateSingleSetting]);

  if (!user || !dbSettings) {
    return null;
  }

  // Use SettingsContext value for immediate UI updates
  const targetSavingsRate = contextSettings.targetSavingsRate;

  const handleRateChange = (value: number) => {
    // Immediately update local context
    updateTargetSavingsRate(value);
    // Debounce database update
    debouncedUpdateRate(value);
  };

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
              targetSavingsRate >= 50
                ? 'text-income'
                : targetSavingsRate >= 30
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-expense'
            )}
          >
            {targetSavingsRate < 30
              ? '偏低'
              : targetSavingsRate > 70
                ? '偏高'
                : '合理'}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
