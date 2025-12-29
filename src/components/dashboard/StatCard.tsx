import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'income' | 'expense' | 'balance';
  showCurrency?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, variant = 'default', showCurrency = true }: StatCardProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  // For balance variant, determine if it's positive or negative
  const isBalancePositive = variant === 'balance' && typeof value === 'number' && value >= 0;

  const variantStyles = {
    default: 'border-border',
    income: '',
    expense: '',
    balance: '',
  };

  const getValueColor = () => {
    if (variant === 'income') return incomeColorClass;
    if (variant === 'expense') return expenseColorClass;
    if (variant === 'balance') return isBalancePositive ? incomeColorClass : expenseColorClass;
    return '';
  };

  const getBorderColor = () => {
    if (variant === 'income') return incomeColorHex;
    if (variant === 'expense') return expenseColorHex;
    if (variant === 'balance') return isBalancePositive ? incomeColorHex : expenseColorHex;
    return '';
  };

  const borderStyle = variant === 'income' || variant === 'expense' || variant === 'balance'
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
          {typeof value === 'number' ? (showCurrency ? `¥${value.toLocaleString()}` : value.toLocaleString()) : value}
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
