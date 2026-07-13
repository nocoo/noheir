/**
 * Colored Badge Components
 *
 * Uses centralized color token system from palette.ts for domain-specific
 * badges (strategy, tactics, status, currency). Falls back to tag-colors
 * for generic labels.
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getLabelColorClasses, getUnitCodePrefix } from "@/lib/tag-colors";
import {
  withAlpha,
  getStrategyToken,
  getTacticsToken,
  getStatusToken,
  getCurrencyToken,
  hashToChartToken,
} from "@/lib/palette";

interface ColoredBadgeProps {
  label: string;
  className?: string | undefined;
}

/**
 * Generic auto-colored badge using tag-colors (Tailwind classes).
 * Uses 20-color DJB2 hash algorithm for consistent colors.
 */
export function ColoredBadge({ label, className }: ColoredBadgeProps) {
  const { bg, text } = getLabelColorClasses(label);

  return (
    <Badge variant="outline" className={cn(bg, text, "border-transparent font-normal", className)}>
      {label}
    </Badge>
  );
}

/**
 * Badge using chart color token (CSS variables).
 * Supports both light and dark mode via hsl with alpha.
 */
function ChartColorBadge({
  label,
  token,
  className,
}: {
  label: string;
  token: string;
  className?: string | undefined;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-normal", className)}
      style={{
        backgroundColor: withAlpha(token, 0.15),
        color: withAlpha(token, 1),
      }}
    >
      {label}
    </Badge>
  );
}

/**
 * Capital unit code badge (colored by prefix letter).
 * e.g., A01 and A02 display same color.
 */
export function UnitCodeBadge({ unitCode, className }: { unitCode: string; className?: string }) {
  const prefix = getUnitCodePrefix(unitCode);
  const token = hashToChartToken(prefix);

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-mono", className)}
      style={{
        backgroundColor: withAlpha(token, 0.15),
        color: withAlpha(token, 1),
      }}
    >
      {unitCode}
    </Badge>
  );
}

/** Strategy badge - uses predefined strategy colors */
export function StrategyBadge({ strategy, className }: { strategy: string; className?: string }) {
  const token = getStrategyToken(strategy);
  return <ChartColorBadge label={strategy} token={token} className={className} />;
}

/** Tactics badge - uses predefined tactics colors */
export function TacticsBadge({ tactics, className }: { tactics: string; className?: string }) {
  const token = getTacticsToken(tactics);
  return <ChartColorBadge label={tactics} token={token} className={className} />;
}

/** Status badge - uses predefined status colors */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const token = getStatusToken(status);
  return <ChartColorBadge label={status} token={token} className={className} />;
}

/** Currency badge - uses predefined currency colors */
export function CurrencyBadge({ currency, className }: { currency: string; className?: string }) {
  const token = getCurrencyToken(currency);
  return <ChartColorBadge label={currency} token={token} className={className} />;
}

/** Channel badge (generic auto-colored) */
export function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  return <ColoredBadge label={channel} className={className} />;
}

/** Category badge (generic auto-colored) */
export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  return <ColoredBadge label={category} className={className} />;
}

/** Product name badge (generic auto-colored) */
export function ProductBadge({
  productName,
  className,
}: {
  productName: string;
  className?: string;
}) {
  const token = hashToChartToken(productName);
  return <ChartColorBadge label={productName} token={token} className={className} />;
}
