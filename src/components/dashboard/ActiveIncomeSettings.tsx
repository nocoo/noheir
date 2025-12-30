import { useState, useCallback, useRef } from 'react';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, DollarSign, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_INCOME_CATEGORIES } from '@/types/category';
import { toast } from 'sonner';

// Get all income tertiary categories grouped by secondary category
const getIncomeCategoriesGrouped = (): Record<string, string[]> => {
  return DEFAULT_INCOME_CATEGORIES;
};

const INCOME_CATEGORIES_GROUPED = getIncomeCategoriesGrouped();

export function ActiveIncomeSettings() {
  const { user } = useAuth();
  const { data, loading, updateSingleSetting } = useSupabaseSettings();
  const { settings: contextSettings, updateActiveIncomeCategories } = useSettings();
  const [showSelector, setShowSelector] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Debounce ref for categories - must be before any conditional returns
  const categoriesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dbSettings = data?.settings;

  // Debounced database update for categories
  const debouncedUpdateCategories = useCallback((categories: string[]) => {
    if (categoriesTimeoutRef.current) {
      clearTimeout(categoriesTimeoutRef.current);
    }
    categoriesTimeoutRef.current = setTimeout(async () => {
      try {
        await updateSingleSetting('activeIncomeCategories', categories);
      } catch (err) {
        console.error('Failed to update active income categories:', err);
      }
    }, 1000);
  }, [updateSingleSetting]);

  if (!user || !dbSettings) {
    return null;
  }

  // Use SettingsContext value for immediate UI updates
  const activeIncomeCategories = contextSettings.activeIncomeCategories;

  const handleToggleCategory = (category: string) => {
    const isActive = activeIncomeCategories.includes(category);
    const newCategories = isActive
      ? activeIncomeCategories.filter(c => c !== category)
      : [...activeIncomeCategories, category];

    // Immediately update local context
    updateActiveIncomeCategories(newCategories);
    // Debounce database update
    debouncedUpdateCategories(newCategories);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const toggleAllInGroup = (groupName: string) => {
    const categories = INCOME_CATEGORIES_GROUPED[groupName];
    const allSelected = categories.every(cat => activeIncomeCategories.includes(cat));

    if (allSelected) {
      // Deselect all
      const newCategories = activeIncomeCategories.filter(cat => !categories.includes(cat));
      updateActiveIncomeCategories(newCategories);
      debouncedUpdateCategories(newCategories);
    } else {
      // Select all
      const newCategories = [...new Set([...activeIncomeCategories, ...categories])];
      updateActiveIncomeCategories(newCategories);
      debouncedUpdateCategories(newCategories);
    }
  };

  return (
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
            <p className="text-sm font-medium">主动收入分类</p>
            <p className="text-xs text-muted-foreground">
              已选择 {activeIncomeCategories.length} / {Object.values(INCOME_CATEGORIES_GROUPED).flat().length} 个分类
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSelector(!showSelector)}
          >
            {showSelector ? '收起' : '选择分类'}
          </Button>
        </div>

        {showSelector && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>点击分类以切换主动/被动收入状态</span>
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {Object.entries(INCOME_CATEGORIES_GROUPED).map(([groupName, categories]) => {
                  const isExpanded = expandedGroups.has(groupName);
                  const allSelected = categories.every(cat => activeIncomeCategories.includes(cat));
                  const someSelected = categories.some(cat => activeIncomeCategories.includes(cat));

                  return (
                    <div key={groupName} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleGroup(groupName)}
                        className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <span className="font-medium text-sm">{groupName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {categories.filter(cat => activeIncomeCategories.includes(cat)).length} / {categories.length}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 space-y-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllInGroup(groupName)}
                            className="h-7 text-xs"
                          >
                            {allSelected ? '取消全选' : '全选'}
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            {categories.map((category) => {
                              const isActive = activeIncomeCategories.includes(category);
                              return (
                                <button
                                  key={category}
                                  onClick={() => handleToggleCategory(category)}
                                  disabled={loading}
                                  className={cn(
                                    'flex items-center gap-2 p-2 rounded-md border text-left transition-colors hover:bg-muted/50 text-sm',
                                    isActive && 'bg-primary/10 border-primary'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0',
                                      isActive ? 'bg-primary border-primary' : 'border-muted-foreground'
                                    )}
                                  >
                                    {isActive && <Check className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                  <span className="truncate">{category}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {activeIncomeCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeIncomeCategories.slice(0, 8).map((category) => (
              <Badge key={category} variant="default" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {category}
              </Badge>
            ))}
            {activeIncomeCategories.length > 8 && (
              <Badge variant="secondary">+{activeIncomeCategories.length - 8} 更多</Badge>
            )}
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
          <p className="font-medium">📌 收入类型说明</p>
          <ul className="text-muted-foreground space-y-1 pl-4">
            <li>
              • <span className="text-primary font-medium">主动收入</span>
              ：需要持续投入时间和劳动获得的收入（如工资、补贴）
            </li>
            <li>
              • <span className="text-muted-foreground font-medium">被动收入</span>
              ：无需持续劳动即可获得的收入（如投资收益、房租、理财）
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
