"use client";

/**
 * Small presentational pieces shared by the unit tooltip and the unit editor's
 * three-column layout. Extracted verbatim from unit-tooltip.tsx.
 */

import type React from "react";
import { cn } from "@/lib/utils";

export function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em]">
      <span className="opacity-70">{icon}</span>
      {label}
    </div>
  );
}

export function DataRow({
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
