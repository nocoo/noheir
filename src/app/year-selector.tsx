"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"

interface YearSelectorProps {
  selectedYear: number | null
  availableYears: number[]
}

export function YearSelector({
  selectedYear,
  availableYears,
}: YearSelectorProps) {
  const router = useRouter()

  if (availableYears.length === 0) return null

  return (
    <Select
      value={selectedYear?.toString() ?? ""}
      onValueChange={(val) => {
        // For now, refresh the page — later can use query params
        router.push(`/?year=${val}`)
      }}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="选择年份" />
      </SelectTrigger>
      <SelectContent>
        {availableYears.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}年
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
