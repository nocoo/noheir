"use client";

import { Activity, CalendarClock, Package2, Sparkles } from "lucide-react";
import type { SerializedUnit } from "@/components/capital/unit-editor";
import {
  CategoryBadge,
  ChannelBadge,
  CurrencyBadge,
  ProductBadge,
  StatusBadge,
  StrategyBadge,
  TacticsBadge,
  UnitCodeBadge,
} from "@/components/ui/colored-badge";
import { Separator } from "@/components/ui/separator";
import type { DomainProduct } from "@/domain/types";
import { formatCurrencyFull, formatDate } from "@/lib/chart-config";
import {
  getAvailabilityToken,
  getStatusToken,
  getStrategyToken,
  getTacticsToken,
  withAlpha,
} from "@/lib/palette";
import { computeUnlockPhase } from "@/lib/unit-tooltip-phase";
import { cn } from "@/lib/utils";

export interface UnitTooltipProps {
  unit: SerializedUnit;
  product: DomainProduct | null;
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em]">
      <span className="opacity-70">{icon}</span>
      {label}
    </div>
  );
}

function DataRow({
  label,
  value,
  dotColor,
  mono = true,
  pulse = false,
}: {
  label: string;
  value: React.ReactNode;
  dotColor?: string;
  mono?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <div className="text-muted-foreground flex items-center gap-1.5">
        {dotColor && (
          <span
            className={cn("size-1.5 rounded-full", pulse && "animate-pulse")}
            style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
          />
        )}
        <span>{label}</span>
      </div>
      <div className={cn("text-foreground text-right", mono && "font-mono tabular-nums")}>
        {value}
      </div>
    </div>
  );
}

export function UnitTooltip({ unit, product }: UnitTooltipProps) {
  const strategyToken = getStrategyToken(unit.strategy);
  const tacticsToken = getTacticsToken(unit.tactics);
  const statusToken = getStatusToken(unit.status);
  const availabilityToken = getAvailabilityToken(unit.daysUntilAvailable, unit.status);

  const phase = computeUnlockPhase(unit, product);
  const availabilityColor = withAlpha(availabilityToken, 1);
  const dash = "—";

  const productName = unit.productName ?? product?.name ?? null;
  const channel = unit.productChannel ?? product?.channel ?? null;
  const category = product?.category ?? null;
  const annual =
    product?.annualReturnRate != null ? `${(product.annualReturnRate * 100).toFixed(2)}%` : null;
  const meta: string[] = [];
  if (product?.lockPeriodDays != null) meta.push(`锁定 ${product.lockPeriodDays}d`);
  if (product?.openDays != null) meta.push(`开放 ${product.openDays}d`);
  if (product?.cycleDays != null) meta.push(`周期 ${product.cycleDays}d`);

  const unlockLabel =
    phase.kind === "locked"
      ? `锁定中 · 距解禁 ${phase.daysLeft} 天`
      : phase.kind === "openWindow"
        ? phase.daysLeft === 0
          ? "已可用 · 开放窗今日关闭"
          : `已可用 · 开放窗剩 ${phase.daysLeft} 天`
        : phase.kind === "available"
          ? "已可用"
          : phase.kind === "planned"
            ? "计划中"
            : phase.kind === "archived"
              ? "已归档"
              : "状态未知";

  const isUrgent = phase.kind === "openWindow" && phase.daysLeft <= 3;

  return (
    <div
      className="bg-background/95 relative w-80 overflow-hidden rounded-lg border shadow-2xl backdrop-blur"
      style={{ borderColor: withAlpha(availabilityToken, 0.35) }}
    >
      <div
        className="h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, ${withAlpha(strategyToken, 1)} 0%, ${withAlpha(
            strategyToken,
            0.35,
          )} 100%)`,
        }}
      />

      {/* Header */}
      <div className="space-y-1.5 px-3.5 pb-2.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <UnitCodeBadge unitCode={unit.unitCode} className="text-[10px]" />
          <StatusBadge status={unit.status} className="text-[10px]" />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground font-mono text-lg font-semibold tabular-nums leading-none">
            {formatCurrencyFull(unit.amount)}
          </span>
          <CurrencyBadge currency={unit.currency} className="text-[10px]" />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-[10px]">
          <StrategyBadge strategy={unit.strategy} className="text-[10px]" />
          <TacticsBadge tactics={unit.tactics} className="text-[10px]" />
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* Product */}
      <div className="space-y-1.5 px-3.5 py-2.5">
        <SectionTitle icon={<Package2 className="size-3" />} label="产品" />
        {productName ? (
          <>
            <ProductBadge productName={productName} className="text-[11px]" />
            <div className="flex flex-wrap items-center gap-1">
              {channel && <ChannelBadge channel={channel} className="text-[9px] px-1.5 py-0" />}
              {category && <CategoryBadge category={category} className="text-[9px] px-1.5 py-0" />}
              {annual && (
                <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                  年化 <span className="text-foreground font-semibold">{annual}</span>
                </span>
              )}
            </div>
            {meta.length > 0 && (
              <div className="text-muted-foreground font-mono text-[10px] tabular-nums tracking-tight">
                {meta.join(" · ")}
              </div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground/60 text-[11px] italic">未绑定产品</div>
        )}
      </div>

      <Separator className="opacity-40" />

      {/* Timeline */}
      <div className="space-y-1 px-3.5 py-2.5">
        <SectionTitle icon={<CalendarClock className="size-3" />} label="时间线" />
        <div className="space-y-1 pt-0.5">
          <DataRow
            label="起始"
            value={unit.startDate ? formatDate(unit.startDate) : dash}
            dotColor={withAlpha(strategyToken, 0.9)}
          />
          <DataRow
            label="最近投入"
            value={unit.latestInvestDate ? formatDate(unit.latestInvestDate) : dash}
            dotColor={withAlpha(tacticsToken, 0.9)}
          />
          <DataRow
            label="解禁日"
            value={unit.availableDate ? formatDate(unit.availableDate) : dash}
            dotColor={withAlpha(availabilityToken, 0.9)}
          />
          <DataRow
            label="归档日"
            value={unit.endDate ? formatDate(unit.endDate) : dash}
            dotColor={withAlpha(statusToken, 0.9)}
          />
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* Unlock Status */}
      <div className="space-y-2 px-3.5 py-2.5">
        <SectionTitle icon={<Activity className="size-3" />} label="解禁状态" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn("size-1.5 rounded-full", isUrgent && "animate-pulse")}
              style={{
                backgroundColor: availabilityColor,
                boxShadow: `0 0 8px ${availabilityColor}`,
              }}
            />
            <span
              className={cn("text-[11px] font-medium", isUrgent && "animate-pulse")}
              style={{ color: availabilityColor }}
            >
              {unlockLabel}
            </span>
          </div>
          {phase.ratio != null && (
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: availabilityColor }}
            >
              {Math.round(phase.ratio * 100)}%
            </span>
          )}
        </div>
        {phase.ratio != null && (
          <div
            className="bg-muted/60 relative h-1 w-full overflow-hidden rounded-full"
            style={{ boxShadow: `inset 0 0 4px ${withAlpha(availabilityToken, 0.15)}` }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${phase.ratio * 100}%`,
                background: `linear-gradient(90deg, ${withAlpha(availabilityToken, 0.7)} 0%, ${availabilityColor} 100%)`,
                boxShadow: `0 0 6px ${availabilityColor}`,
              }}
            />
            <div
              className="absolute top-1/2 h-2 w-[2px] -translate-y-1/2 rounded-full"
              style={{
                left: `calc(${phase.ratio * 100}% - 1px)`,
                backgroundColor: availabilityColor,
                boxShadow: `0 0 8px ${availabilityColor}`,
              }}
            />
          </div>
        )}
      </div>

      {unit.note && (
        <>
          <Separator className="opacity-40" />
          <div className="space-y-1 px-3.5 py-2.5">
            <SectionTitle icon={<Sparkles className="size-3" />} label="备注" />
            <p className="text-foreground/80 line-clamp-3 text-[11px] leading-relaxed">
              {unit.note}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
