import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';
import { useState } from 'react';
import { formatCurrencyFull } from '@/lib/chart-config';
import { useSettings, getIncomeColorHsl, getExpenseColorHsl } from '@/contexts/SettingsContext';

interface IncomeExpenseHeatmapProps {
  transactions: Transaction[];
}

interface DayInfo {
  count: number;
  income: number;
  expense: number;
}

// Income color palette (Emerald-like) - 5 levels
const INCOME_COLORS = [
  'hsl(var(--muted))',      // 无收入 - 灰色
  'hsl(var(--income-bg))',  // 低收入 - Emerald-50
  'hsl(var(--income-light))', // 中低收入 - Emerald-100
  'hsl(var(--income-dark))',  // 中高收入 - Emerald-500
  'hsl(var(--income))',     // 高收入 - Emerald-600
];

// Expense color palette (Rose-like) - 5 levels
const EXPENSE_COLORS = [
  'hsl(var(--muted))',      // 无支出 - 灰色
  'hsl(var(--expense-bg))',  // 低支出 - Rose-50
  'hsl(var(--expense-light))', // 中低支出 - Rose-100
  'hsl(var(--expense-dark))',  // 中高支出 - Rose-500
  'hsl(var(--expense))',     // 高支出 - Rose-600
];

export function IncomeExpenseHeatmap({ transactions }: IncomeExpenseHeatmapProps) {
  const { settings } = useSettings();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Aggregate data by date - count, income, and expense
  const dailyData = new Map<string, DayInfo>();

  for (const t of transactions) {
    const dateObj = new Date(t.date);
    const day = dateObj.getDate();
    const dateKey = `${String(t.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const existing = dailyData.get(dateKey) || { count: 0, income: 0, expense: 0 };
    existing.count += 1;
    if (t.type === 'income') {
      existing.income += t.amount;
    } else if (t.type === 'expense') {
      existing.expense += t.amount;
    }
    dailyData.set(dateKey, existing);
  }

  // Calculate max income and expense for color levels
  const allIncomes = Array.from(dailyData.values()).map(d => d.income).filter(v => v > 0);
  const allExpenses = Array.from(dailyData.values()).map(d => d.expense).filter(v => v > 0);
  const maxIncome = allIncomes.length > 0 ? Math.max(...allIncomes) : 1;
  const maxExpense = allExpenses.length > 0 ? Math.max(...allExpenses) : 1;
  const totalDays = dailyData.size;

  // Get color level based on amount
  const getIncomeLevel = (amount: number): number => {
    if (amount === 0) return 0;
    const ratio = amount / maxIncome;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.7) return 3;
    return 4;
  };

  const getExpenseLevel = (amount: number): number => {
    if (amount === 0) return 0;
    const ratio = amount / maxExpense;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.7) return 3;
    return 4;
  };

  // Get the first day of the current year
  const currentYear = new Date().getFullYear();
  const startDate = new Date(currentYear, 0, 1);
  const startDay = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Create weeks array with full day info
  const weeks: Array<{ date: Date; info: DayInfo | null }[]> = [];
  let currentWeek: Array<{ date: Date; info: DayInfo | null }> = [];

  // Add empty cells for days before Jan 1
  for (let i = 0; i < startDay; i++) {
    currentWeek.push({ date: new Date(currentYear, 0, 1 - (startDay - i)), info: null });
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

    currentWeek.push({ date, info });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Add remaining days
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const handleMouseEnter = (dayData: { date: Date; info: DayInfo | null }, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const date = dayData.date;
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;

    let content = '';
    if (dayData.info) {
      const incomeClass = 'text-income';
      const expenseClass = 'text-expense';
      content = `
        <div class="font-semibold mb-2">${dateStr}</div>
        <div class="text-sm text-muted-foreground mb-1">${dayData.info.count} 笔交易</div>
        ${dayData.info.income > 0 ? `<div class="${incomeClass} text-xs">+${formatCurrencyFull(dayData.info.income)}</div>` : '<div class="text-xs text-muted-foreground">无收入</div>'}
        ${dayData.info.expense > 0 ? `<div class="${expenseClass} text-xs">-${formatCurrencyFull(dayData.info.expense)}</div>` : '<div class="text-xs text-muted-foreground">无支出</div>'}
        ${dayData.info.income > 0 && dayData.info.expense > 0 ? `<div class="text-xs text-muted-foreground mt-1">净收支: ${formatCurrencyFull(dayData.info.income - dayData.info.expense)}</div>` : ''}
      `;
    } else {
      content = `
        <div class="font-semibold">${dateStr}</div>
        <div class="text-sm text-muted-foreground">无交易</div>
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
  const totalIncome = Array.from(dailyData.values()).reduce((sum, d) => sum + d.income, 0);
  const totalExpense = Array.from(dailyData.values()).reduce((sum, d) => sum + d.expense, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>收支热力图 ({currentYear}年)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>少</span>
              <div className="flex items-center">
                <div className="w-4 h-3 rounded-l" style={{ backgroundColor: INCOME_COLORS[0] }}></div>
                <div className="w-4 h-3" style={{ backgroundColor: INCOME_COLORS[1] }}></div>
                <div className="w-4 h-3" style={{ backgroundColor: INCOME_COLORS[2] }}></div>
                <div className="w-4 h-3" style={{ backgroundColor: INCOME_COLORS[3] }}></div>
                <div className="w-4 h-3 rounded-r" style={{ backgroundColor: INCOME_COLORS[4] }}></div>
              </div>
              <span className="ml-1 text-income font-medium">收入</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-expense font-medium">支出</span>
              <div className="flex items-center">
                <div className="w-4 h-3 rounded-l" style={{ backgroundColor: EXPENSE_COLORS[0] }}></div>
                <div className="w-4 h-3" style={{ backgroundColor: EXPENSE_COLORS[1] }}></div>
                <div className="w-4 h-3" style={{ backgroundColor: EXPENSE_COLORS[2] }}></div>
                <div className="w-4 h-3" style={{ backgroundColor: EXPENSE_COLORS[3] }}></div>
                <div className="w-4 h-3 rounded-r" style={{ backgroundColor: EXPENSE_COLORS[4] }}></div>
              </div>
              <span>多</span>
            </div>
          </div>

          {/* Heatmap */}
          <div className="overflow-x-auto">
            <div className="inline-flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((dayData, dayIndex) => {
                    const incomeLevel = dayData.info ? getIncomeLevel(dayData.info.income) : 0;
                    const expenseLevel = dayData.info ? getExpenseLevel(dayData.info.expense) : 0;
                    const hasData = dayData.info !== null;

                    return (
                      <div
                        key={dayIndex}
                        className="w-6 h-3 rounded-sm overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 flex"
                        onMouseEnter={(e) => handleMouseEnter(dayData, e)}
                        onMouseLeave={handleMouseLeave}
                        style={{ opacity: hasData ? 1 : 0.3 }}
                      >
                        {/* Left half - Income */}
                        <div
                          className="h-full flex-1"
                          style={{ backgroundColor: INCOME_COLORS[incomeLevel] }}
                        />
                        {/* Right half - Expense */}
                        <div
                          className="h-full flex-1"
                          style={{ backgroundColor: EXPENSE_COLORS[expenseLevel] }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex gap-6 text-muted-foreground">
              <div>
                <span>活跃天数: </span>
                <span className="font-semibold text-foreground">{totalDays}</span>
              </div>
              <div>
                <span>总交易: </span>
                <span className="font-semibold text-foreground">{totalCounts} 笔</span>
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-muted-foreground">总收入: </span>
                <span className="font-semibold text-income">{formatCurrencyFull(totalIncome)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">总支出: </span>
                <span className="font-semibold text-expense">{formatCurrencyFull(totalExpense)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 p-3 text-sm bg-card text-card-foreground border border-border rounded-lg shadow-lg pointer-events-none min-w-[200px]"
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
