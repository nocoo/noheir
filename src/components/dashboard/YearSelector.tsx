import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface YearSelectorProps {
  selectedYear: number;
  availableYears: number[];
  onChange: (year: number) => void;
}

export function YearSelector({ selectedYear, availableYears, onChange }: YearSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="year-select" className="text-sm font-medium whitespace-nowrap">
        选择年份
      </Label>
      <Select value={selectedYear.toString()} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger id="year-select" className="w-[120px]">
          <SelectValue placeholder="选择年份" />
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
