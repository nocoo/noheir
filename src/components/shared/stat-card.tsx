"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string
  icon: React.ElementType
  variant: "income" | "expense" | "warning" | "primary"
}

const variantStyles: Record<
  StatCardProps["variant"],
  { border: string; bg: string; text: string; iconText: string }
> = {
  income: {
    border: "border-l-income",
    bg: "bg-emerald-500/5",
    text: "text-income",
    iconText: "text-income",
  },
  expense: {
    border: "border-l-expense",
    bg: "bg-rose-500/5",
    text: "text-expense",
    iconText: "text-expense",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
    iconText: "text-amber-600 dark:text-amber-400",
  },
  primary: {
    border: "border-l-primary",
    bg: "bg-primary/5",
    text: "text-primary",
    iconText: "text-primary",
  },
}

export function StatCard({ title, value, icon: Icon, variant }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <Card className={cn("border-l-4", styles.border, styles.bg)}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-xs">{title}</p>
          <p className={cn("truncate text-xl font-bold", styles.text)}>
            {value}
          </p>
        </div>
        <Icon className={cn("size-7 shrink-0 opacity-40", styles.iconText)} />
      </CardContent>
    </Card>
  )
}
