import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/types/category';
import { Sun, Moon, Monitor, Palette, Layers, ChevronDown, ChevronRight, Target, DollarSign, TrendingUp, Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// Get all income tertiary categories
const getAllIncomeTertiaryCategories = (): string[] => {
  const allCategories: string[] = [];
  Object.values(DEFAULT_INCOME_CATEGORIES).forEach(tertiaryList => {
    allCategories.push(...tertiaryList);
  });
  return allCategories.sort();
};

const ALL_INCOME_TERTIARY = getAllIncomeTertiaryCategories();

export function Settings() {
  const { settings, updateTheme, updateColorScheme, updateTargetSavingsRate, toggleActiveIncomeCategory, isCategoryActiveIncome } = useSettings();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showActiveIncomeSelector, setShowActiveIncomeSelector] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Category mapping display component
  const CategoryMappingDisplay = ({
    title,
    mappings,
    icon: Icon
  }: {
    title: string;
    mappings: Record<string, string[]>;
    icon: LucideIcon;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>二级分类与三级分类的映射关系（只读）</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {Object.entries(mappings).map(([secondary, tertiaryList]) => (
              <div key={secondary} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(`${title}-${secondary}`)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedCategories.has(`${title}-${secondary}`) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{secondary}</span>
                    <Badge variant="secondary" className="text-xs">
                      {tertiaryList.length}
                    </Badge>
                  </div>
                </button>
                {expandedCategories.has(`${title}-${secondary}`) && (
                  <div className="p-3 pt-0 border-t bg-muted/20">
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tertiaryList.map((tertiary) => (
                        <Badge
                          key={tertiary}
                          variant="outline"
                          className="text-xs px-2 py-1"
                        >
                          {tertiary}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

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

      {/* Active vs Passive Income Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            收入类型分类
          </CardTitle>
          <CardDescription>设置哪些收入分类为主动收入（需付出时间/劳动），默认所有收入为被动收入</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>主动收入分类</Label>
              <p className="text-sm text-muted-foreground">
                已选择 {settings.activeIncomeCategories.length} / {ALL_INCOME_TERTIARY.length} 个分类
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActiveIncomeSelector(!showActiveIncomeSelector)}
            >
              {showActiveIncomeSelector ? '收起' : '选择分类'}
            </Button>
          </div>

          {showActiveIncomeSelector && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <DollarSign className="h-4 w-4" />
                <span>点击分类以切换主动/被动收入状态</span>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="grid grid-cols-2 gap-2">
                  {ALL_INCOME_TERTIARY.map((category) => {
                    const isActive = isCategoryActiveIncome(category);
                    return (
                      <button
                        key={category}
                        onClick={() => toggleActiveIncomeCategory(category)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md border text-left transition-colors hover:bg-muted/50",
                          isActive && "bg-primary/10 border-primary"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-sm border flex items-center justify-center",
                          isActive ? "bg-primary border-primary" : "border-muted-foreground"
                        )}>
                          {isActive && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm">{category}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {settings.activeIncomeCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.activeIncomeCategories.slice(0, 10).map((category) => (
                <Badge key={category} variant="default" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {category}
                </Badge>
              ))}
              {settings.activeIncomeCategories.length > 10 && (
                <Badge variant="secondary">
                  +{settings.activeIncomeCategories.length - 10} 更多
                </Badge>
              )}
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <p className="font-medium">📌 收入类型说明</p>
            <ul className="text-muted-foreground space-y-1 pl-4">
              <li>• <span className="text-primary font-medium">主动收入</span>：需要持续投入时间和劳动获得的收入（如工资、补贴）</li>
              <li>• <span className="text-muted-foreground font-medium">被动收入</span>：无需持续劳动即可获得的收入（如投资收益、房租、理财）</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Target Savings Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            目标储蓄率
          </CardTitle>
          <CardDescription>设置每月的储蓄目标比例</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>目标储蓄率</Label>
              <span className="text-2xl font-bold text-primary">{settings.targetSavingsRate}%</span>
            </div>
            <Slider
              value={[settings.targetSavingsRate]}
              onValueChange={(value) => updateTargetSavingsRate(value[0])}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            建议储蓄率在 30%-70% 之间，当前设置：<span className={cn(
              settings.targetSavingsRate >= 50 ? 'text-income font-semibold' :
              settings.targetSavingsRate >= 30 ? 'text-yellow-600 dark:text-yellow-400 font-semibold' :
              'text-expense font-semibold'
            )}>
              {settings.targetSavingsRate < 30 ? '偏低' : settings.targetSavingsRate > 70 ? '偏高' : '合理'}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Category Mappings */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">分类映射</h2>
          <p className="text-sm text-muted-foreground">查看二级分类与三级分类的对应关系</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryMappingDisplay
            title="支出分类"
            mappings={DEFAULT_EXPENSE_CATEGORIES}
            icon={Layers}
          />
          <CategoryMappingDisplay
            title="收入分类"
            mappings={DEFAULT_INCOME_CATEGORIES}
            icon={Layers}
          />
        </div>
      </div>
    </div>
  );
}
