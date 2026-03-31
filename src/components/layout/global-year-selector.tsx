"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAvailableYears } from "@/app/actions/get-available-years"

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

  const currentYear = searchParams.get("year") ?? years[0]?.toString() ?? ""

  return (
    <Select
      value={currentYear}
      onValueChange={(val) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("year", val)
        startTransition(() => {
          router.push(`${pathname}?${params.toString()}`)
        })
      }}
      disabled={isPending}
    >
      <SelectTrigger className="w-[100px] h-8 text-sm">
        <SelectValue placeholder="年份" />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}年
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
