import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import type { Theme, ColorScheme } from '@/contexts/SettingsContext';
import { getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';

export function ThemeSettings() {
  const { user } = useAuth();
  const { settings: contextSettings, updateTheme, updateColorScheme } = useSettings();

  if (!user) {
    return null;
  }

  // Use SettingsContext values for immediate UI updates
  const theme: Theme = contextSettings.theme;
  const colorScheme: ColorScheme = contextSettings.colorScheme;

  const handleThemeChange = (newTheme: Theme) => {
    // Only update localStorage (no database sync)
    updateTheme(newTheme);
    toast.success('主题已更新');
  };

  const handleColorSchemeChange = (newColorScheme: ColorScheme) => {
    // Only update localStorage (no database sync)
    updateColorScheme(newColorScheme);
    toast.success('颜色方案已更新');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          主题设置
        </CardTitle>
        <CardDescription>选择应用的外观主题和颜色方案</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Mode */}
        <div className="space-y-3">
          <label className="text-sm font-medium">主题模式</label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => handleThemeChange('light')}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Sun className="h-5 w-5" />
              <span className="text-sm">浅色</span>
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => handleThemeChange('dark')}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Moon className="h-5 w-5" />
              <span className="text-sm">深色</span>
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              onClick={() => handleThemeChange('system')}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Monitor className="h-5 w-5" />
              <span className="text-sm">跟随系统</span>
            </Button>
          </div>
        </div>

        {/* Color Scheme */}
        <div className="space-y-3">
          <label className="text-sm font-medium">颜色方案</label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={colorScheme === 'default' ? 'default' : 'outline'}
              onClick={() => handleColorSchemeChange('default')}
              className="flex flex-col items-center gap-3 h-24"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-full border-2 border-background"
                  style={{ backgroundColor: getIncomeColorHex('default') }}
                />
                <span className="text-sm">收入</span>
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-full border-2 border-background"
                  style={{ backgroundColor: getExpenseColorHex('default') }}
                />
                <span className="text-sm">支出</span>
              </div>
            </Button>
            <Button
              variant={colorScheme === 'swapped' ? 'default' : 'outline'}
              onClick={() => handleColorSchemeChange('swapped')}
              className="flex flex-col items-center gap-3 h-24"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-full border-2 border-background"
                  style={{ backgroundColor: getIncomeColorHex('swapped') }}
                />
                <span className="text-sm">收入</span>
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-full border-2 border-background"
                  style={{ backgroundColor: getExpenseColorHex('swapped') }}
                />
                <span className="text-sm">支出</span>
              </div>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {colorScheme === 'default'
              ? '默认：收入为绿色，支出为红色'
              : '切换：收入为红色，支出为绿色'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
