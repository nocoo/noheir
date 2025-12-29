import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';

export function Settings() {
  const { settings, updateTheme, updateColorScheme } = useSettings();

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            主题设置
          </CardTitle>
          <CardDescription>选择应用的外观主题</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label>主题模式</Label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={settings.theme === 'light' ? 'default' : 'outline'}
              onClick={() => updateTheme('light')}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Sun className="h-5 w-5" />
              <span className="text-sm">浅色</span>
            </Button>
            <Button
              variant={settings.theme === 'dark' ? 'default' : 'outline'}
              onClick={() => updateTheme('dark')}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Moon className="h-5 w-5" />
              <span className="text-sm">深色</span>
            </Button>
            <Button
              variant={settings.theme === 'system' ? 'default' : 'outline'}
              onClick={() => updateTheme('system')}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Monitor className="h-5 w-5" />
              <span className="text-sm">跟随系统</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Color Scheme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            颜色方案
          </CardTitle>
          <CardDescription>设置收入和支出的显示颜色</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label>颜色方案</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={settings.colorScheme === 'default' ? 'default' : 'outline'}
              onClick={() => updateColorScheme('default')}
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
              variant={settings.colorScheme === 'swapped' ? 'default' : 'outline'}
              onClick={() => updateColorScheme('swapped')}
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
          <p className="text-sm text-muted-foreground mt-2">
            {settings.colorScheme === 'default' ? '默认：收入为绿色，支出为红色' : '切换：收入为红色，支出为绿色'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
