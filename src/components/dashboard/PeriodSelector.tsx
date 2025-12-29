import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface PeriodSelectorProps {
  mode: 'monthly' | 'yearly';
  onModeChange: (mode: 'monthly' | 'yearly') => void;
  selectedYear: number;
  selectedMonth?: number;
  comparisonPeriods: string[];
  availableYears: number[];
  onYearChange: (year: number) => void;
  onMonthChange?: (month: number) => void;
  onAddComparison: (period: string) => void;
  onRemoveComparison: (period: string) => void;
}

const months = [
  { value: 1, label: '一月' },
  { value: 2, label: '二月' },
  { value: 3, label: '三月' },
  { value: 4, label: '四月' },
  { value: 5, label: '五月' },
  { value: 6, label: '六月' },
  { value: 7, label: '七月' },
  { value: 8, label: '八月' },
  { value: 9, label: '九月' },
  { value: 10, label: '十月' },
  { value: 11, label: '十一月' },
  { value: 12, label: '十二月' },
];

export function PeriodSelector({
  mode,
  onModeChange,
  selectedYear,
  selectedMonth = 1,
  comparisonPeriods,
  availableYears,
  onYearChange,
  onMonthChange,
  onAddComparison,
  onRemoveComparison,
}: PeriodSelectorProps) {
  const getCurrentPeriod = () => {
    if (mode === 'yearly') return `${selectedYear}`;
    return `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
  };

  const getAvailablePeriods = () => {
    if (mode === 'yearly') {
      return availableYears.map(y => `${y}`);
    }
    const periods: string[] = [];
    availableYears.forEach(year => {
      months.forEach(month => {
        periods.push(`${year}-${month.value.toString().padStart(2, '0')}`);
      });
    });
    return periods;
  };

  const formatPeriod = (period: string) => {
    if (mode === 'yearly') return `${period}年`;
    const [year, month] = period.split('-');
    const monthLabel = months.find(m => m.value === parseInt(month))?.label || month;
    return `${year}年${monthLabel}`;
  };

  const availablePeriods = getAvailablePeriods().filter(
    p => p !== getCurrentPeriod() && !comparisonPeriods.includes(p)
  );

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Mode Toggle */}
          <Tabs value={mode} onValueChange={(v) => onModeChange(v as 'monthly' | 'yearly')}>
            <TabsList>
              <TabsTrigger value="monthly">按月</TabsTrigger>
              <TabsTrigger value="yearly">按年</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Primary Period Selection */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">主要时段:</span>
            <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}年</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {mode === 'monthly' && onMonthChange && (
              <Select value={String(selectedMonth)} onValueChange={(v) => onMonthChange(parseInt(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Comparison Periods */}
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground whitespace-nowrap">对比时段:</span>
            
            {comparisonPeriods.map(period => (
              <Badge key={period} variant="secondary" className="gap-1">
                {formatPeriod(period)}
                <button
                  onClick={() => onRemoveComparison(period)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}

            {availablePeriods.length > 0 && comparisonPeriods.length < 3 && (
              <Select onValueChange={onAddComparison}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <span className="text-muted-foreground">+ 添加对比</span>
                </SelectTrigger>
                <SelectContent>
                  {availablePeriods.slice(0, 20).map(period => (
                    <SelectItem key={period} value={period}>
                      {formatPeriod(period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
