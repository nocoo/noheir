import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import { CategorySummary } from '@/types/transaction';
import { tooltipStyle, xAxisStyle } from '@/lib/chart-config';

interface ExpenseRadarProps {
  currentData: CategorySummary[];
  previousData?: CategorySummary[];
  currentLabel?: string;
  previousLabel?: string;
}

export function ExpenseRadar({ 
  currentData, 
  previousData, 
  currentLabel = '本期',
  previousLabel = '上期' 
}: ExpenseRadarProps) {
  // Merge categories from both periods
  const allCategories = new Set([
    ...currentData.map(d => d.category),
    ...(previousData?.map(d => d.category) || [])
  ]);

  const radarData = Array.from(allCategories).map(category => {
    const current = currentData.find(d => d.category === category);
    const previous = previousData?.find(d => d.category === category);
    return {
      category,
      current: current?.percentage || 0,
      previous: previous?.percentage || 0,
      currentAmount: current?.total || 0,
      previousAmount: previous?.total || 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>支出结构雷达图</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="category"
                {...xAxisStyle}
              />
              <PolarRadiusAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={tooltipStyle.contentStyle}
                formatter={(value: number, name: string, props: any) => {
                  const amount = name === 'current' ? props.payload.currentAmount : props.payload.previousAmount;
                  return [`${value.toFixed(1)}% (¥${amount.toLocaleString()})`, name === 'current' ? currentLabel : previousLabel];
                }}
              />
              {previousData && (
                <Radar 
                  name="previous" 
                  dataKey="previous" 
                  stroke="hsl(var(--chart-5))" 
                  fill="hsl(var(--chart-5))" 
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
              <Radar 
                name="current" 
                dataKey="current" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Legend 
                formatter={(value) => value === 'current' ? currentLabel : previousLabel}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
