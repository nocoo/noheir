"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Layers } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyK, formatCurrencyFull } from "@/lib/chart-config";
import { ChartCard } from "@/components/shared/chart-card";

/** Category drill-down structure for the distribution chart */
export interface CategoryGroup {
  primary: string;
  total: number;
  percentage: number;
  secondaryCategories: Array<{
    name: string;
    total: number;
  }>;
}

export interface CategoryDistributionChartProps {
  title: string;
  description: string;
  detailList: CategoryGroup[];
  colors: string[];
  tooltipColor: string;
}

export function CategoryDistributionChart({
  title,
  description,
  detailList,
  colors,
  tooltipColor,
}: CategoryDistributionChartProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<string>("all");

  const categoryBarData =
    selectedPrimary === "all"
      ? detailList.map((c) => ({ name: c.primary, value: c.total }))
      : (detailList
          .find((p) => p.primary === selectedPrimary)
          ?.secondaryCategories.map((s) => ({
            name: s.name,
            value: s.total,
          })) ?? []);

  const safeColors = colors.length > 0 ? colors : ["#64748b"];

  return (
    <ChartCard
      title={title}
      description={description}
      icon={Layers}
      actions={
        <Select value={selectedPrimary} onValueChange={setSelectedPrimary}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择层级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">按一级分类</SelectItem>
            {detailList.map((cat) => (
              <SelectItem key={cat.primary} value={cat.primary}>
                {cat.primary}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={categoryBarData}
            layout="vertical"
            margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
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
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0];
                return (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium">{entry?.payload?.name}</p>
                    <p style={{ color: tooltipColor }}>
                      金额: {formatCurrencyFull(Number(entry?.value ?? 0))}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {categoryBarData.map((entry, index) => {
                const color = safeColors[index % safeColors.length] ?? safeColors[0] ?? "#64748b";
                return <Cell key={`bar-${entry.name}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
