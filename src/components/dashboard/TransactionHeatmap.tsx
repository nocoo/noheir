import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';
import { useState, useMemo } from 'react';
import { formatCurrencyFull } from '@/lib/chart-config';
import { useSettings } from '@/contexts/SettingsContext';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { HEATMAP_GREEN_PALETTE, HEATMAP_RED_PALETTE } from '@/lib/colorPalette';

type TransactionType = 'income' | 'expense';

interface TransactionHeatmapProps {
  transactions: Transaction[];
  year: number;
  type: TransactionType;
  colorPalette?: 'green' | 'red';  // Optional override
  embedded?: boolean;  // If true, don't wrap in Card (for embedding in other containers)
}

interface DayInfo {
  count: number;
  amount: number;
}

export function TransactionHeatmap({ transactions, year, type, colorPalette, embedded = false }: TransactionHeatmapProps) {
  const { settings } = useSettings();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const isIncome = type === 'income';

  // Auto-detect palette if not specified
  const palette = colorPalette ?? (isIncome ? 'green' : 'red');

  // Select color palette based on type and color scheme
  // Income: green when default, red when swapped
  // Expense: red when default, green when swapped
  const COLORS = useMemo(() => {
    if (palette === 'green') {
      return settings.colorScheme === 'swapped' ? HEATMAP_RED_PALETTE : HEATMAP_GREEN_PALETTE;
    } else {
      return settings.colorScheme === 'swapped' ? HEATMAP_GREEN_PALETTE : HEATMAP_RED_PALETTE;
    }
  }, [settings.colorScheme, palette]);

  // Get color class for text based on ACTUAL display color (not type)
  // When green palette is used (income default, expense swapped), use green text
  // When red palette is used (expense default, income swapped), use red text
  const actualPaletteIsGreen = useMemo(() => {
    if (palette === 'green') {
      return settings.colorScheme !== 'swapped';
    } else {
      return settings.colorScheme === 'swapped';
    }
  }, [palette, settings.colorScheme]);

  const colorClass = actualPaletteIsGreen ? 'text-income' : 'text-expense';

  // Aggregate transaction data by date
  const dailyData = useMemo(() => {
    const data = new Map<string, DayInfo>();

    for (const t of transactions) {
      // Filter by type and year
      if (t.year !== year || t.type !== type) continue;

      const dateObj = new Date(t.date);
      const dateKey = `${String(t.month).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      const existing = data.get(dateKey) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += t.amount;
      data.set(dateKey, existing);
    }

    return data;
  }, [transactions, year, type]);

  // Calculate max amount for color levels
  const amounts = Array.from(dailyData.values()).map(d => d.amount);
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 1;
  const totalDays = dailyData.size;

  // Get the first day of the selected year
  const startDate = new Date(year, 0, 1);
  const startDay = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Create weeks array with full day info
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

    const typeLabel = isIncome ? '收入' : '支出';
    const sign = isIncome ? '+' : '-';

    let content = '';
    if (dayData.info) {
      content = `
        <div class="font-semibold">${dateStr}</div>
        <div class="text-sm text-muted-foreground mb-1">${dayData.info.count} 笔${typeLabel}</div>
        <div class="${colorClass} text-xs">${sign}${formatCurrencyFull(dayData.info.amount)}</div>
      `;
    } else {
      content = `
        <div class="font-semibold">${dateStr}</div>
        <div class="text-sm text-muted-foreground">无${typeLabel}</div>
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
  const totalAmount = Array.from(dailyData.values()).reduce((sum, d) => sum + d.amount, 0);

  // Dynamic labels based on type
  const Icon = isIncome ? TrendingUp : TrendingDown;
  const title = `${isIncome ? '收入' : '支出'}热力图`;
  const typeLabel = isIncome ? '收入' : '支出';

  // Content wrapper (can be embedded or in Card)
  const content = (
    <>
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

        {/* Stats */}
        <div className="flex justify-end gap-6 text-sm text-muted-foreground">
          <div>
            <span>活跃天数: </span>
            <span className="font-semibold">{totalDays.toLocaleString()}</span>
          </div>
          <div>
            <span>单日最高: </span>
            <span className={`font-semibold ${colorClass}`}>{formatCurrencyFull(maxAmount)}</span>
          </div>
          <div>
            <span>总{typeLabel}: </span>
            <span className={`font-semibold ${colorClass}`}>{formatCurrencyFull(totalAmount)}</span>
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
    </>
  );

  // If embedded, return without Card wrapper (for warehouse view unified container)
  if (embedded) {
    return (
      <div className="space-y-4">
        {/* Embedded header */}
        <div className="flex items-center gap-2 px-6 pt-6">
          <Icon className={`h-5 w-5 ${colorClass}`} />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {/* Content */}
        <div className="px-6 pb-6">
          {content}
        </div>
      </div>
    );
  }

  // Default: return with Card wrapper (standalone)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${colorClass}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
