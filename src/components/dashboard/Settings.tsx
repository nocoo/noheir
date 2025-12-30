import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SettingsSync } from '@/components/dashboard/SettingsSync';
import { SiteName } from '@/components/dashboard/SiteName';
import { ThemeSettings } from '@/components/dashboard/ThemeSettings';
import { SavingsRateSettings } from '@/components/dashboard/SavingsRateSettings';
import { ActiveIncomeSettings } from '@/components/dashboard/ActiveIncomeSettings';

export function Settings() {
  return (
    <>
      {/* Sync settings from Supabase to SettingsContext */}
      <SettingsSync />

      <div className="grid grid-cols-1 gap-6">
        <SiteName />
        <ThemeSettings />
        <SavingsRateSettings />
        <ActiveIncomeSettings />
      </div>
    </>
  );
}
