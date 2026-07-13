"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        className="size-7"
        onClick={goPrev}
        disabled={!canGoPrev || isPending}
        aria-label="上一年"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {/* Year labels */}
      <div className="flex items-center">
        {years.map((y) => (
          <Button
            key={y}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-sm font-medium",
              y === year
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => navigateToYear(y)}
            disabled={isPending}
          >
            {y}
          </Button>
        ))}
      </div>

      {/* Next year (newer) */}
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={goNext}
        disabled={!canGoNext || isPending}
        aria-label="下一年"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
