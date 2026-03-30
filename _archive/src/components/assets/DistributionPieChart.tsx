import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieTooltip } from '@/lib/chart-tooltip';
import { formatCurrencyFull } from '@/lib/chart-config';

interface DistributionData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface DistributionPieChartProps {
  title: string;
  data: DistributionData[];
  onClick?: (name: string) => void;
  selected?: string | null;
  showAction?: boolean;
}

export function DistributionPieChart({
  title,
  data,
  onClick,
  selected,
  showAction = false
}: DistributionPieChartProps) {
  return (
    <div className="border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {showAction && selected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClick?.(null)}
          >
            <EyeOff className="w-4 h-4 mr-1" />
            清除筛选
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* Chart */}
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                onClick={onClick ? (entry) => onClick?.(
                  selected === entry.name ? null : entry.name
                ) : undefined}
                className={onClick ? "cursor-pointer" : ""}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={selected && selected !== entry.name ? 'transparent' : 'white'}
                    strokeWidth={2}
                    opacity={selected && selected !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {data.map((item) => (
            <div
              key={item.name}
              className={cn(
                "flex items-center justify-between gap-2 p-1.5 rounded whitespace-nowrap",
                onClick ? "cursor-pointer transition-colors" : "",
                selected && selected !== item.name ? "opacity-30" : "hover:bg-muted/50",
                !selected && onClick && "hover:bg-muted/50"
              )}
              onClick={() => onClick?.(
                selected === item.name ? null : item.name
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium truncate">{item.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                <p className="text-sm font-bold">{formatCurrencyFull(item.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
