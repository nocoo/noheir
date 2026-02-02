import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, TrendingDown, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFixedExpenseSettingsViewModel } from '@/viewmodels/settings/useFixedExpenseSettingsViewModel';

export function FixedExpenseSettings() {
  const {
    isVisible,
    loading,
    grouped,
    totalCategories,
    fixedExpenseCategories,
    showSelector,
    expandedGroups,
    setShowSelector,
    toggleGroup,
    toggleAll,
    handleToggleCategory,
    getGroupStats,
  } = useFixedExpenseSettingsViewModel();

  if (!isVisible) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          支出类型分类
        </CardTitle>
        <CardDescription>设置哪些支出分类为固定支出（每个月必须支付的钱），默认所有支出为弹性支出</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">固定支出分类</p>
            <p className="text-xs text-muted-foreground">
              已选择 {fixedExpenseCategories.length} / {totalCategories} 个分类
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
              <TrendingDown className="h-4 w-4" />
              <span>点击分类以切换固定/弹性支出状态</span>
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {Object.entries(grouped).map(([groupName, categories]) => {
                  const categoryList = categories || [];
                  if (categoryList.length === 0) return null;
                  const isExpanded = expandedGroups.has(groupName);
                  const { allSelected, someSelected, selected } = getGroupStats(groupName);

                  return (
                    <div key={groupName} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleGroup(groupName)}
                        className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <span className="font-medium text-sm">{groupName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {selected} / {categoryList.length}
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
                            onClick={() => toggleAll(groupName)}
                            className="h-7 text-xs"
                          >
                            {allSelected ? '取消全选' : '全选'}
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            {categoryList.map((category) => {
                              const isFixed = fixedExpenseCategories.includes(category);
                              return (
                                <button
                                  key={category}
                                  onClick={() => handleToggleCategory(category)}
                                  disabled={loading}
                                  className={cn(
                                    'flex items-center gap-2 p-2 rounded-md border text-left transition-colors hover:bg-muted/50 text-sm',
                                    isFixed && 'bg-primary/10 border-primary'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0',
                                      isFixed ? 'bg-primary border-primary' : 'border-muted-foreground'
                                    )}
                                  >
                                    {isFixed && <Check className="h-3 w-3 text-primary-foreground" />}
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

        {fixedExpenseCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fixedExpenseCategories.slice(0, 8).map((category) => (
              <Badge key={category} variant="default" className="gap-1">
                <TrendingDown className="h-3 w-3" />
                {category}
              </Badge>
            ))}
            {fixedExpenseCategories.length > 8 && (
              <Badge variant="secondary">+{fixedExpenseCategories.length - 8} 更多</Badge>
            )}
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
          <p className="font-medium">📌 支出类型说明</p>
          <ul className="text-muted-foreground space-y-1 pl-4">
            <li>
              • <span className="text-primary font-medium">固定支出</span>
              ：每个月必须支付的刚性支出（如房贷房租、保险、物业费等）
            </li>
            <li>
              • <span className="text-muted-foreground font-medium">弹性支出</span>
              ：可以控制或延后的非必要支出（如娱乐、购物等）
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
