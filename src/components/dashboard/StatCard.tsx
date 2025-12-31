import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { formatCurrencyFull } from '@/lib/chart-config';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'income' | 'expense' | 'balance' | 'savings';
  showCurrency?: boolean;
  savingsValue?: number; // For savings variant to determine color
}

export function StatCard({ title, value, icon: Icon, trend, variant = 'default', showCurrency = true, savingsValue }: StatCardProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  // For balance variant, determine if it's positive or negative
  const isBalancePositive = variant === 'balance' && typeof value === 'number' && value >= 0;

  // For savings variant, determine color based on savings rate
  const getSavingsColor = () => {
    const rate = savingsValue ?? 0;
    if (rate >= 30) return 'text-emerald-600'; // 优秀 - 绿色
    if (rate >= 20) return 'text-green-600'; // 良好 - 浅绿
    if (rate >= 10) return 'text-yellow-600'; // 一般 - 黄色
    if (rate >= 0) return 'text-orange-600'; // 较差 - 橙色
    return 'text-red-600'; // 危险 - 红色
  };

  const getSavingsBorderColor = () => {
    const rate = savingsValue ?? 0;
    if (rate >= 30) return '#059669'; // emerald-600
    if (rate >= 20) return '#16a34a'; // green-600
    if (rate >= 10) return '#ca8a04'; // yellow-600
    if (rate >= 0) return '#ea580c'; // orange-600
    return '#dc2626'; // red-600
  };

  const variantStyles = {
    default: 'border-border',
    income: '',
    expense: '',
    balance: '',
    savings: '',
  };

  const getValueColor = () => {
    if (variant === 'income') return incomeColorClass;
    if (variant === 'expense') return expenseColorClass;
    if (variant === 'balance') return isBalancePositive ? incomeColorClass : expenseColorClass;
    if (variant === 'savings') return getSavingsColor();
    return '';
  };

  const getBorderColor = () => {
    if (variant === 'income') return incomeColorHex;
    if (variant === 'expense') return expenseColorHex;
    if (variant === 'balance') return isBalancePositive ? incomeColorHex : expenseColorHex;
    if (variant === 'savings') return getSavingsBorderColor();
    return '';
  };

  const borderStyle = variant === 'income' || variant === 'expense' || variant === 'balance' || variant === 'savings'
    ? { borderLeftColor: getBorderColor(), borderLeftWidth: '4px' }
    : {};

  return (
    <Card
      className={cn('transition-all hover:shadow-md', variantStyles[variant])}
      style={borderStyle}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', getValueColor())}>
          {typeof value === 'number' ? (showCurrency ? formatCurrencyFull(value) : value.toLocaleString()) : value}
        </div>
        {trend && (
          <p className={cn(
            'text-xs mt-1',
            trend.isPositive ? incomeColorClass : expenseColorClass
          )}>
            {trend.isPositive ? '+' : ''}{trend.value}% 较上期
          </p>
        )}
      </CardContent>
    </Card>
  );
}
