"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string
  icon: React.ElementType
  variant: "income" | "expense" | "warning"
}

const variantStyles: Record<StatCardProps["variant"], string> = {
  income: "border-l-income text-income",
  expense: "border-l-expense text-expense",
  warning: "border-l-amber-500 text-amber-600 dark:text-amber-400",
}

export function StatCard({ title, value, icon: Icon, variant }: StatCardProps) {
  const styles = variantStyles[variant]
  const borderColor = styles.split(" ")[0] ?? ""
  const textColor = styles
    .split(" ")
    .filter((c) => c.startsWith("text-") || c.startsWith("dark:text-"))
    .join(" ")

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardContent className="flex items-center justify-between pt-4">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className={cn("text-2xl font-bold", textColor)}>{value}</p>
        </div>
        <Icon
          className={cn("size-8 opacity-30", textColor)}
        />
      </CardContent>
    </Card>
  )
}
