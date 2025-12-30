import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SettingsSync } from '@/components/dashboard/SettingsSync';
import { SiteMetadata } from '@/components/dashboard/SiteMetadata';
import { ThemeSettings } from '@/components/dashboard/ThemeSettings';
import { SavingsRateSettings } from '@/components/dashboard/SavingsRateSettings';
import { ActiveIncomeSettings } from '@/components/dashboard/ActiveIncomeSettings';

export function Settings() {
  return (
    <>
      {/* Sync settings from Supabase to SettingsContext */}
      <SettingsSync />

      <div className="grid grid-cols-1 gap-6">
        <SiteMetadata />
        <ThemeSettings />
        <SavingsRateSettings />
        <ActiveIncomeSettings />
      </div>
    </>
  );
}
