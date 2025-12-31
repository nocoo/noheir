import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';
import { useState, useMemo } from 'react';
import { formatCurrencyFull } from '@/lib/chart-config';
import { useSettings, ColorScheme } from '@/contexts/SettingsContext';
import { TrendingUp } from 'lucide-react';

interface IncomeHeatmapProps {
  transactions: Transaction[];
  year: number;
}

interface DayInfo {
  count: number;
  amount: number;
}

// GitHub-style green gradient palette
const GREEN_PALETTE = [
  '#ebedf0',  // 无数据 - 浅灰
  '#9be9a8',  // 低 - 浅绿
  '#40c463',  // 中低
  '#30a14e',  // 中高
  '#216e39',  // 高 - 深绿
];

// GitHub-style red gradient palette
const RED_PALETTE = [
  '#ebedf0',  // 无数据 - 浅灰
  '#ffc1cc',  // 低 - 浅红
  '#ff8fab',  // 中低
  '#f43f5e',  // 中高
  '#be123c',  // 高 - 深红
];

export function IncomeHeatmap({ transactions, year }: IncomeHeatmapProps) {
  const { settings } = useSettings();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Select color palette based on color scheme
  const COLORS = settings.colorScheme === 'swapped' ? RED_PALETTE : GREEN_PALETTE;

  // Aggregate income data by date
  const dailyData = useMemo(() => {
    const data = new Map<string, DayInfo>();

    for (const t of transactions) {
      // Only process income transactions for the selected year
      if (t.year !== year || t.type !== 'income') continue;

      const dateObj = new Date(t.date);
      const day = dateObj.getDate();
      const dateKey = `${String(t.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const existing = data.get(dateKey) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += t.amount;
      data.set(dateKey, existing);
    }

    return data;
  }, [transactions, year]);

  // Calculate max amount for color levels
  const amounts = Array.from(dailyData.values()).map(d => d.amount);
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 1;
  const totalDays = dailyData.size;

  // Get the first day of the selected year
  const startDate = new Date(year, 0, 1);
  const startDay = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Create weeks array with full day info - use useMemo to recalculate when year or dailyData changes
  const weeks = useMemo(() => {
    const weeksArray: Array<{ level: number; date: Date; info: DayInfo | null }[]> = [];
    let currentWeek: Array<{ level: number; date: Date; info: DayInfo | null }> = [];

    // Add empty cells for days before Jan 1
    for (let i = 0; i < startDay; i++) {
      currentWeek.push({ level: 0, date: new Date(year, 0, 1 - (startDay - i)), info: null });
    }

    // Add all days of the year (handle leap years)
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeapYear ? 366 : 365;

    for (let day = 1; day <= daysInYear; day++) {
      const date = new Date(year, 0, day);
      const month = date.getMonth() + 1;
      const dayOfMonth = date.getDate();

      // Key format: MM-DD to match what we stored
      const dateKey = `${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
      const info = dailyData.get(dateKey) || null;
      const amount = info?.amount || 0;

      // Calculate color level based on amount
      let level = 0;
      if (amount > 0) {
        const ratio = amount / maxAmount;
        if (ratio <= 0.25) level = 1;
        else if (ratio <= 0.5) level = 2;
        else if (ratio <= 0.75) level = 3;
        else level = 4;
      }

      currentWeek.push({ level, date, info });

      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add remaining days
    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek);
    }

    return weeksArray;
  }, [year, dailyData, maxAmount, startDay]);

  const handleMouseEnter = (dayData: { level: number; date: Date; info: DayInfo | null }, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const date = dayData.date;
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;

    let content = '';
    if (dayData.info) {
      content = `
        <div class="font-semibold">${dateStr}</div>
        <div class="text-sm text-muted-foreground mb-1">${dayData.info.count} 笔收入</div>
        <div class="text-income text-xs">+${formatCurrencyFull(dayData.info.amount)}</div>
      `;
    } else {
      content = `
        <div class="font-semibold">${dateStr}</div>
        <div class="text-sm text-muted-foreground">无收入</div>
      `;
    }

    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      content,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  // Calculate totals for stats
  const totalCounts = Array.from(dailyData.values()).reduce((sum, d) => sum + d.count, 0);
  const totalAmount = Array.from(dailyData.values()).reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-income" />
          收入热力图
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Heatmap */}
          <div className="overflow-x-auto">
            <div className="inline-flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((dayData, dayIndex) => (
                    <div
                      key={dayIndex}
                      className="w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary/50"
                      style={{ backgroundColor: COLORS[dayData.level] }}
                      onMouseEnter={(e) => handleMouseEnter(dayData, e)}
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[0] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[1] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[2] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[3] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[4] }}></div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-end gap-6 text-sm text-muted-foreground">
            <div>
              <span>活跃天数: </span>
              <span className="font-semibold">{totalDays.toLocaleString()}</span>
            </div>
            <div>
              <span>单日最高: </span>
              <span className="font-semibold text-income">{formatCurrencyFull(maxAmount)}</span>
            </div>
            <div>
              <span>总收入: </span>
              <span className="font-semibold text-income">{formatCurrencyFull(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 p-4 text-sm bg-card text-card-foreground border border-border rounded-lg shadow-lg pointer-events-none min-w-[180px]"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
          />
        )}
      </CardContent>
    </Card>
  );
}
