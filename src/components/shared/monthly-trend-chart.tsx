import { overlayPanelClass } from "@nocoo/basalt/components/overlay";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/shared/chart-card";
import type { MonthlyData } from "@/domain/types";
import { formatCurrencyFull, formatCurrencyK } from "@/lib/chart-config";

export interface MonthlyTrendChartProps {
  title: string;
  description?: string;
  monthlyData: MonthlyData[];
  averageValue: number;
  colorHex: string;
  dataKey: "income" | "expense";
  icon: React.ElementType;
}

export function MonthlyTrendChart({
  title,
  description,
  monthlyData,
  averageValue,
  colorHex,
  dataKey,
  icon,
}: MonthlyTrendChartProps) {
  const gradientId = `${dataKey}Gradient`;
  const labelText = dataKey === "income" ? "收入" : "支出";

  return (
    <ChartCard title={title} {...(description ? { description } : {})} icon={icon}>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorHex} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-basalt-border/50" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              className="text-basalt-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-basalt-muted-foreground"
              tickFormatter={formatCurrencyK}
            />
            <Tooltip
              content={({ active, payload, label: tooltipLabel }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0];
                return (
                  <div
                    className={overlayPanelClass(
                      "px-basalt-card-sm py-basalt-space-lg text-basalt-sm",
                    )}
                  >
                    <p className="font-medium">{tooltipLabel}</p>
                    <p className="text-basalt-muted-foreground">
                      {labelText}: {formatCurrencyFull(Number(entry?.value ?? 0))}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={averageValue}
              stroke={colorHex}
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `平均 ${formatCurrencyFull(averageValue)}`,
                fill: colorHex,
                fontSize: 11,
                position: "right",
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={colorHex}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
