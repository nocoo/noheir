import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/**
 * 统一年份选择器
 *
 * 支持两种模式：
 * - single: 单选模式（下拉框）
 * - multi: 多选模式（复选框组）
 */
export interface UnifiedYearSelectorProps {
  mode: 'single' | 'multi';
  selectedYear?: number | null;
  selectedYears?: number[];
  availableYears: number[];
  onChange?: (year: number) => void;
  onMultiChange?: (years: number[]) => void;
  label?: string;
  width?: string;
  disabled?: boolean;
}

/**
 * 单选模式 - 下拉框
 */
function SingleYearSelector({
  selectedYear,
  availableYears,
  onChange,
  label = '选择年份',
  width = '120px',
  disabled,
}: Omit<UnifiedYearSelectorProps, 'mode' | 'selectedYears' | 'onMultiChange'>) {
  const value = selectedYear?.toString() ?? '';
  const isDisabled = disabled || availableYears.length === 0;

  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="year-select" className="text-sm font-medium whitespace-nowrap">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange?.(parseInt(v, 10))} disabled={isDisabled}>
        <SelectTrigger id="year-select" className={`w-[${width}]`}>
          <SelectValue placeholder={availableYears.length === 0 ? '暂无数据' : label} />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}年
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * 多选模式 - 复选框组
 */
function MultiYearSelector({
  selectedYears = [],
  availableYears,
  onMultiChange,
  label = '对比年份:',
}: Omit<UnifiedYearSelectorProps, 'mode' | 'selectedYear' | 'onChange' | 'width' | 'disabled'>) {
  const handleYearToggle = (year: number, checked: boolean) => {
    if (!onMultiChange) return;

    if (checked) {
      onMultiChange([...selectedYears, year].sort((a, b) => a - b));
    } else {
      onMultiChange(selectedYears.filter((y) => y !== year));
    }
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Label className="text-sm font-medium">{label}</Label>
      {availableYears.sort((a, b) => a - b).map((year) => (
        <div key={year} className="flex items-center gap-2">
          <Checkbox
            id={`year-${year}`}
            checked={selectedYears.includes(year)}
            onCheckedChange={(checked) => handleYearToggle(year, !!checked)}
          />
          <Label htmlFor={`year-${year}`} className="text-sm cursor-pointer">
            {year}年
          </Label>
        </div>
      ))}
    </div>
  );
}

/**
 * 统一年份选择器组件
 */
export function UnifiedYearSelector({ mode, ...props }: UnifiedYearSelectorProps) {
  if (mode === 'single') {
    return <SingleYearSelector {...props} />;
  }

  return <MultiYearSelector {...props} />;
}
