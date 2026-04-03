"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAvailableYears } from "@/app/actions/get-available-years"
import { cn } from "@/lib/utils"

/**
 * Paths where the global year selector should be visible.
 * These are pages that accept `?year=` as a query parameter.
 */
const YEAR_ENABLED_PATHS = new Set([
  "/",
  "/savings",
  "/freedom",
  "/income",
  "/expense",
  "/flow",
  "/financial-health",
  "/ai-insight",
  "/account",
  "/account-detail",
])

const CURRENT_YEAR = new Date().getFullYear()

export function GlobalYearSelector() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [years, setYears] = useState<number[]>([CURRENT_YEAR])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getAvailableYears()
      .then((fetched) => {
        setYears(fetched.length > 0 ? fetched : [CURRENT_YEAR])
      })
      .catch(() => setYears([CURRENT_YEAR]))
  }, [])

  if (!YEAR_ENABLED_PATHS.has(pathname)) return null

  const currentYear = Number(searchParams.get("year") ?? years[0] ?? CURRENT_YEAR)
  const currentIndex = years.indexOf(currentYear)
  const canGoPrev = currentIndex < years.length - 1 // years are sorted desc
  const canGoNext = currentIndex > 0

  const navigateToYear = (year: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("year", year.toString())
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const goPrev = () => {
    const prevYear = years[currentIndex + 1]
    if (canGoPrev && prevYear !== undefined) navigateToYear(prevYear)
  }

  const goNext = () => {
    const nextYear = years[currentIndex - 1]
    if (canGoNext && nextYear !== undefined) navigateToYear(nextYear)
  }

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
        {years.map((year) => (
          <Button
            key={year}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-sm font-medium",
              year === currentYear
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => navigateToYear(year)}
            disabled={isPending}
          >
            {year}
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
  )
}
