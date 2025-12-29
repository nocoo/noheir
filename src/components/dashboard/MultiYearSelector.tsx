import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface MultiYearSelectorProps {
  selectedYears: number[];
  availableYears: number[];
  onChange: (years: number[]) => void;
}

export function MultiYearSelector({ selectedYears, availableYears, onChange }: MultiYearSelectorProps) {
  const handleYearToggle = (year: number, checked: boolean) => {
    if (checked) {
      onChange([...selectedYears, year].sort((a, b) => a - b));
    } else {
      onChange(selectedYears.filter(y => y !== year));
    }
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Label className="text-sm font-medium">对比年份:</Label>
      {availableYears.map(year => (
        <div key={year} className="flex items-center gap-2">
          <Checkbox
            id={`year-${year}`}
            checked={selectedYears.includes(year)}
            onCheckedChange={(checked) => handleYearToggle(year, !!checked)}
          />
          <Label htmlFor={`year-${year}`} className="text-sm cursor-pointer">
            {year} 年
          </Label>
        </div>
      ))}
    </div>
  );
}
