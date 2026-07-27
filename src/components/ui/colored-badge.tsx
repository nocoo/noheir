/**
 * Colored Badge Components
 *
 * Every badge here renders from the chart token palette in palette.ts, so the
 * capital domain reads as one system in both light and dark mode. Known values
 * (strategy, tactics, status, currency, product category) get a dedicated hue;
 * free-text values (unit code prefix, channel) are hashed onto the same palette.
 */

import { Badge } from "@/components/ui/badge";
import {
  getCurrencyToken,
  getProductCategoryToken,
  getProductToken,
  getStatusToken,
  getStrategyToken,
  getTacticsToken,
  hashToChartToken,
  withAlpha,
} from "@/lib/palette";
import { getUnitCodePrefix } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

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

/** Channel badge — channels are free text, so hashed onto the chart palette. */
export function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  return (
    <ChartColorBadge label={channel} token={hashToChartToken(channel)} className={className} />
  );
}

/** Category badge — one dedicated hue per known product category. */
export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  return (
    <ChartColorBadge
      label={category}
      token={getProductCategoryToken(category)}
      className={className}
    />
  );
}

/**
 * Product name badge.
 *
 * Coloured by `category` when known: hashing 34 product names into 22 slots
 * collides ~79% of the time, which made two unrelated products share a colour
 * for no reason. Category colouring makes a shared colour mean "same kind".
 * Falls back to hashing the name when no category is available.
 */
export function ProductBadge({
  productName,
  category,
  className,
}: {
  productName: string;
  category?: string | null | undefined;
  className?: string;
}) {
  const token = getProductToken(productName, category);
  return <ChartColorBadge label={productName} token={token} className={className} />;
}
