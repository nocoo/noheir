import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CategorySummary } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface CategoryBreakdownProps {
  data: CategorySummary[];
}

const CATEGORY_COLORS = [
  'bg-[hsl(var(--chart-1))]',
  'bg-[hsl(var(--chart-2))]',
  'bg-[hsl(var(--chart-3))]',
  'bg-[hsl(var(--chart-4))]',
  'bg-[hsl(var(--chart-5))]',
  'bg-primary',
  'bg-secondary',
];

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>分类明细</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">暂无支出数据</p>
        ) : (
          data.map((category, index) => (
            <div key={category.category} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', CATEGORY_COLORS[index % CATEGORY_COLORS.length])} />
                  <span className="font-medium">{category.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{category.percentage.toFixed(1)}%</span>
                  <span className="font-medium">¥{category.total.toLocaleString()}</span>
                </div>
              </div>
              <Progress 
                value={category.percentage} 
                className="h-2"
              />
              {category.subcategories.length > 0 && (
                <div className="pl-5 space-y-1">
                  {category.subcategories.map(sub => (
                    <div key={sub.name} className="flex justify-between text-xs text-muted-foreground">
                      <span>{sub.name}</span>
                      <span>¥{sub.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
