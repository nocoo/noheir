import { Button } from "@nocoo/basalt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTransition } from "react";
import { useYear } from "./year-context";

export function GlobalYearSelector() {
  const { year, years, setYear, isYearEnabled } = useYear();
  const [isPending, startTransition] = useTransition();

  if (!isYearEnabled) return null;

  const currentIndex = years.indexOf(year);
  const canGoPrev = currentIndex < years.length - 1; // years are sorted desc
  const canGoNext = currentIndex > 0;

  const navigateToYear = (newYear: number) => {
    startTransition(() => {
      setYear(newYear);
    });
  };

  const goPrev = () => {
    const prevYear = years[currentIndex + 1];
    if (canGoPrev && prevYear !== undefined) navigateToYear(prevYear);
  };

  const goNext = () => {
    const nextYear = years[currentIndex - 1];
    if (canGoNext && nextYear !== undefined) navigateToYear(nextYear);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Previous year (older) */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        onClick={goPrev}
        disabled={!canGoPrev || isPending}
        aria-label="上一年"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Select
        value={String(year)}
        onValueChange={(value) => navigateToYear(Number(value))}
        disabled={isPending}
      >
        <SelectTrigger aria-label="财务年份" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Next year (newer) */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        onClick={goNext}
        disabled={!canGoNext || isPending}
        aria-label="下一年"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
