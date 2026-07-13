"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CreditCard } from "lucide-react";
import { formatCurrencyK, formatCurrencyFull } from "@/lib/chart-config";
import { ChartCard } from "@/components/shared/chart-card";

export interface AccountChartData {
  name: string;
  value: number;
  percentage?: number | undefined;
}

export interface AccountDistributionChartProps {
  title: string;
  description: string;
  accountData: AccountChartData[];
  colorHex: string;
  layout: "horizontal" | "vertical";
}

export function AccountDistributionChart({
  title,
  description,
  accountData,
  colorHex,
  layout,
}: AccountDistributionChartProps) {
  const isVertical = layout === "vertical";

  return (
    <ChartCard title={title} description={description} icon={CreditCard}>
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={accountData}
            layout={layout}
            margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            {isVertical ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={formatCurrencyK}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
              </>
            ) : (
              <>
                <XAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={formatCurrencyK}
                />
              </>
            )}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pct = (entry?.payload as any)?.percentage as number | undefined;
                return (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium">{entry?.payload?.name}</p>
                    <p className="text-muted-foreground">
                      金额: {formatCurrencyFull(Number(entry?.value ?? 0))}
                      {pct ? ` (${pct.toFixed(1)}%)` : ""}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              fill={colorHex}
              radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
