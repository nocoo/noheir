import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SiteName } from '@/components/dashboard/SiteName';
import { ThemeSettings } from '@/components/dashboard/ThemeSettings';
import { SavingsRateSettings } from '@/components/dashboard/SavingsRateSettings';
import { ActiveIncomeSettings } from '@/components/dashboard/ActiveIncomeSettings';
import { FixedExpenseSettings } from '@/components/dashboard/FixedExpenseSettings';
import { ReturnRateSettings } from '@/components/dashboard/ReturnRateSettings';

export function Settings() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <SiteName />
      <ThemeSettings />
      <SavingsRateSettings />
      <ActiveIncomeSettings />
      <FixedExpenseSettings />
      <ReturnRateSettings />
    </div>
  );
}
