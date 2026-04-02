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
  { border: string; text: string; iconText: string }
> = {
  income: {
    border: "border-l-income",
    text: "text-income",
    iconText: "text-income",
  },
  expense: {
    border: "border-l-expense",
    text: "text-expense",
    iconText: "text-expense",
  },
  warning: {
    border: "border-l-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    iconText: "text-amber-600 dark:text-amber-400",
  },
  primary: {
    border: "border-l-primary",
    text: "text-primary",
    iconText: "text-primary",
  },
}

export function StatCard({ title, value, icon: Icon, variant }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <Card className={cn("border-l-4 bg-card", styles.border)}>
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
