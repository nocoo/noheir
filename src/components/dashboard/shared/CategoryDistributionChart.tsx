import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Layers } from 'lucide-react';
import { PrimaryCategory } from '@/types/category-shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';

export interface CategoryDistributionChartProps {
  title: string;
  description: string;
  detailList: PrimaryCategory[];
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
  const [selectedPrimary, setSelectedPrimary] = useState<string>('all');

  // Prepare data for horizontal bar chart based on selection
  const categoryBarData = selectedPrimary === 'all'
    ? detailList.map(c => ({ name: c.primary, value: c.total }))
    : detailList.find(p => p.primary === selectedPrimary)?.secondaryCategories.map(s => ({ name: s.name, value: s.total })) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Select value={selectedPrimary} onValueChange={setSelectedPrimary}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择层级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">按一级分类</SelectItem>
              {detailList.map(cat => (
                <SelectItem key={cat.primary} value={cat.primary}>
                  {cat.primary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categoryBarData}
              layout="vertical"
              margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
            >
              <CartesianGrid {...gridStyle} />
              <XAxis type="number" {...xAxisStyle} tickFormatter={formatCurrencyK} />
              <YAxis type="category" dataKey="name" width={100} {...yAxisStyle} />
              <Tooltip
                formatter={(value: number) => [formatCurrencyFull(value), '金额']}
                contentStyle={tooltipStyle.contentStyle}
                itemStyle={{ color: tooltipColor }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {categoryBarData.map((entry, index) => (
                  <Cell key={`bar-${entry.name}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
