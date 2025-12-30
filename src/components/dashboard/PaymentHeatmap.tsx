import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';
import { useState } from 'react';
import { formatCurrencyFull } from '@/lib/chart-config';

interface PaymentHeatmapProps {
  transactions: Transaction[];
}

interface DayInfo {
  count: number;
  amount: number;
}

// Green color palette - 5 levels for transaction density
const COLORS = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];

export function PaymentHeatmap({ transactions }: PaymentHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Aggregate data by date - count and total amount
  const dailyData = new Map<string, DayInfo>();

  for (const t of transactions) {
    const dateObj = new Date(t.date);
    const day = dateObj.getDate();
    const dateKey = `${String(t.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const existing = dailyData.get(dateKey) || { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += t.amount;
    dailyData.set(dateKey, existing);
  }

  const counts = Array.from(dailyData.values()).map(d => d.count);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
  const totalDays = dailyData.size;

  // Get the first day of the current year
  const currentYear = new Date().getFullYear();
  const startDate = new Date(currentYear, 0, 1);
  const startDay = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Create weeks array with full day info
  const weeks: Array<{ level: number; date: Date; info: DayInfo | null }[]> = [];
  let currentWeek: Array<{ level: number; date: Date; info: DayInfo | null }> = [];

  // Add empty cells for days before Jan 1
  for (let i = 0; i < startDay; i++) {
    currentWeek.push({ level: 0, date: new Date(currentYear, 0, 1 - (startDay - i)), info: null });
  }

  // Add all days of the year (handle leap years)
  const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0;
  const daysInYear = isLeapYear ? 366 : 365;

  for (let day = 1; day <= daysInYear; day++) {
    const date = new Date(currentYear, 0, day);
    const month = date.getMonth() + 1;
    const dayOfMonth = date.getDate();

    // Key format: MM-DD to match what we stored
    const dateKey = `${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    const info = dailyData.get(dateKey) || null;
    const count = info?.count || 0;

    // Calculate color level based on count
    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }

    currentWeek.push({ level, date, info });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Add remaining days
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const handleMouseEnter = (dayData: { level: number; date: Date; info: DayInfo | null }, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const date = dayData.date;
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;

    let content = '';
    if (dayData.info) {
      content = `
        <div class="font-semibold">${dateStr}</div>
        <div class="mt-1">${dayData.info.count} 笔交易</div>
        <div class="text-muted-foreground">${formatCurrencyFull(dayData.info.amount)}</div>
      `;
    } else {
      content = `
        <div class="font-semibold">${dateStr}</div>
        <div class="text-muted-foreground">无交易</div>
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

  const totalCounts = Array.from(dailyData.values()).reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>支付热力图 ({currentYear}年)</CardTitle>
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
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>少</span>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[0] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[1] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[2] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[3] }}></div>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[4] }}></div>
            </div>
            <span>多</span>
          </div>

          {/* Stats */}
          <div className="flex justify-end gap-6 text-sm text-muted-foreground">
            <div>
              <span>活跃天数: </span>
              <span className="font-semibold">{totalDays}</span>
            </div>
            <div>
              <span>单日最多: </span>
              <span className="font-semibold">{maxCount} 笔</span>
            </div>
            <div>
              <span>总交易: </span>
              <span className="font-semibold">{totalCounts} 笔</span>
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
