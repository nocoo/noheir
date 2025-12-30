import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface YearSelectorProps {
  selectedYear: number | null;
  availableYears: number[];
  onChange: (year: number) => void;
}

export function YearSelector({ selectedYear, availableYears, onChange }: YearSelectorProps) {
  // Handle null or undefined selectedYear
  const value = selectedYear?.toString() ?? "";

  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="year-select" className="text-sm font-medium whitespace-nowrap">
        选择年份
      </Label>
      <Select value={value} onValueChange={(v) => onChange(parseInt(v))} disabled={availableYears.length === 0}>
        <SelectTrigger id="year-select" className="w-[120px]">
          <SelectValue placeholder={availableYears.length === 0 ? "暂无数据" : "选择年份"} />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map(year => (
            <SelectItem key={year} value={year.toString()}>
              {year} 年
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
