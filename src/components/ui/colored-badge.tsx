/**
 * Colored Badge Components
 *
 * Hash-based colored badge system using 20-color palette.
 * Ensures same label always displays same color across all pages.
 */

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLabelColorClasses, getUnitCodePrefix } from "@/lib/tag-colors"

interface ColoredBadgeProps {
  label: string
  className?: string | undefined
}

/**
 * Generic auto-colored badge.
 * Uses 20-color DJB2 hash algorithm for consistent colors.
 */
export function ColoredBadge({ label, className }: ColoredBadgeProps) {
  const { bg, text } = getLabelColorClasses(label)

  return (
    <Badge
      variant="outline"
      className={cn(bg, text, "border-transparent font-normal", className)}
    >
      {label}
    </Badge>
  )
}

/**
 * Capital unit code badge (colored by prefix letter).
 * e.g., A01 and A02 display same color.
 */
export function UnitCodeBadge({
  unitCode,
  className,
}: {
  unitCode: string
  className?: string
}) {
  const prefix = getUnitCodePrefix(unitCode)
  const { bg, text } = getLabelColorClasses(prefix)

  return (
    <Badge
      variant="outline"
      className={cn(bg, text, "border-transparent font-mono", className)}
    >
      {unitCode}
    </Badge>
  )
}

/** Strategy badge (auto-colored) */
export function StrategyBadge({
  strategy,
  className,
}: {
  strategy: string
  className?: string
}) {
  return <ColoredBadge label={strategy} className={className} />
}

/** Tactics badge (auto-colored) */
export function TacticsBadge({
  tactics,
  className,
}: {
  tactics: string
  className?: string
}) {
  return <ColoredBadge label={tactics} className={className} />
}

/** Status badge (auto-colored) */
export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  return <ColoredBadge label={status} className={className} />
}

/** Channel badge (auto-colored) */
export function ChannelBadge({
  channel,
  className,
}: {
  channel: string
  className?: string
}) {
  return <ColoredBadge label={channel} className={className} />
}

/** Category badge (auto-colored) */
export function CategoryBadge({
  category,
  className,
}: {
  category: string
  className?: string
}) {
  return <ColoredBadge label={category} className={className} />
}
