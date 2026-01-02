import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LucideIcon, Info } from 'lucide-react';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { formatCurrencyFull } from '@/lib/chart-config';
import { getScoreRatingColors } from '@/lib/colorPalette';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'default' | 'income' | 'expense' | 'balance' | 'savings';
  showCurrency?: boolean;
  savingsValue?: number;
  targetSavingsRate?: number;
}

export function StatCard({ title, value, icon: Icon, variant = 'default', showCurrency = true, savingsValue, targetSavingsRate }: StatCardProps) {
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
    const colors = getScoreRatingColors(rate);
    return colors.text;
  };

  const getSavingsBorderColor = () => {
    const rate = savingsValue ?? 0;
    const colors = getScoreRatingColors(rate);
    return colors.hex;
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
        <div className="flex items-center gap-1">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {variant === 'savings' && targetSavingsRate !== undefined && savingsValue !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">
                    目标 {targetSavingsRate}%
                    {savingsValue >= targetSavingsRate
                      ? ` ✓ 超出 ${(savingsValue - targetSavingsRate).toFixed(1)}%`
                      : ` ✗ 差距 ${(targetSavingsRate - savingsValue).toFixed(1)}%`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', getValueColor())}>
          {typeof value === 'number' ? (showCurrency ? formatCurrencyFull(value) : value.toLocaleString()) : value}
        </div>
      </CardContent>
    </Card>
  );
}
