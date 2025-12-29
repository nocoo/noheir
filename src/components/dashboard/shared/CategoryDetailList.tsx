import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { PrimaryCategory } from '@/types/category-shared';

export interface CategoryDetailListProps {
  title: string;
  description: string;
  detailList: PrimaryCategory[];
  colorHex: string;
  colorClass: string;
  totalAmount: number;
  colors: string[];
}

export function CategoryDetailList({
  title,
  description,
  detailList,
  colorHex,
  colorClass,
  totalAmount,
  colors,
}: CategoryDetailListProps) {
  // Collapsed state for secondary and tertiary categories - default all collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Initialize with all categories collapsed
  useEffect(() => {
    const allKeys = new Set<string>();

    detailList.forEach(cat => {
      cat.secondaryCategories.forEach(sub => {
        allKeys.add(`${cat.primary}-${sub.name}`);
        sub.tertiaryList.forEach(tertiary => {
          allKeys.add(`${cat.primary}-${sub.name}-${tertiary.name}`);
        });
      });
    });

    setCollapsed(allKeys);
  }, [detailList]);

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {detailList.map((cat, i) => {
            const primaryColor = colors[i % colors.length];
            return (
              <div key={cat.primary} className="rounded-lg overflow-hidden">
                {/* Primary Category Row */}
                <div className="flex items-center gap-3 py-2 px-3 bg-muted/20">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span className="font-medium flex-1">{cat.primary}</span>
                  {/* Progress Bar */}
                  <div className="w-32 flex-shrink-0">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: primaryColor
                        }}
                      />
                    </div>
                  </div>
                  <span className={`font-semibold text-right w-28 flex-shrink-0 ${colorClass}`}>
                    ¥{cat.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Secondary Categories */}
                {cat.secondaryCategories.length > 0 && (
                  <div className="ml-6 mt-2 space-y-1">
                    {cat.secondaryCategories.map(sub => {
                      const secondaryKey = `${cat.primary}-${sub.name}`;
                      const isSubCollapsed = collapsed.has(secondaryKey);
                      const subPercentage = cat.total > 0 ? (sub.total / cat.total) * 100 : 0;

                      return (
                        <div key={sub.name} className="rounded-lg overflow-hidden">
                          {/* Secondary Category Row - Clickable */}
                          <button
                            onClick={() => toggleCollapse(secondaryKey)}
                            className="w-full flex items-center gap-3 py-2 px-3 hover:bg-muted/30 transition-colors text-left"
                          >
                            <div className="flex-shrink-0">
                              {isSubCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground font-medium flex-1">{sub.name}</span>
                            {/* Progress Bar */}
                            <div className="w-32 flex-shrink-0">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${subPercentage}%`,
                                    backgroundColor: colorHex
                                  }}
                                />
                              </div>
                            </div>
                            <span className="text-sm text-right w-28 flex-shrink-0">¥{sub.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </button>

                          {/* Tertiary Categories & Transactions */}
                          {!isSubCollapsed && sub.tertiaryList.length > 0 && (
                            <div className="ml-8 space-y-1">
                              {sub.tertiaryList.map(tertiary => {
                                const tertiaryKey = `${cat.primary}-${sub.name}-${tertiary.name}`;
                                const isTertiaryCollapsed = collapsed.has(tertiaryKey);
                                const tertiaryPercentage = sub.total > 0 ? (tertiary.total / sub.total) * 100 : 0;

                                return (
                                  <div key={tertiary.name} className="rounded-lg overflow-hidden">
                                    {/* Tertiary Category Row - Clickable */}
                                    <button
                                      onClick={() => toggleCollapse(tertiaryKey)}
                                      className="w-full flex items-center gap-3 py-2 px-3 hover:bg-muted/20 transition-colors text-left"
                                    >
                                      <div className="flex-shrink-0">
                                        {isTertiaryCollapsed ? (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        )}
                                      </div>
                                      <span className="text-sm text-muted-foreground flex-1">{tertiary.name}</span>
                                      {/* Progress Bar */}
                                      <div className="w-32 flex-shrink-0">
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${tertiaryPercentage}%`,
                                              backgroundColor: colorHex,
                                              opacity: 0.7
                                            }}
                                          />
                                        </div>
                                      </div>
                                      <span className="text-sm text-right w-28 flex-shrink-0">¥{tertiary.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </button>

                                    {/* Transactions */}
                                    {!isTertiaryCollapsed && tertiary.transactions && tertiary.transactions.map((tx, idx) => {
                                      const txPercentage = tertiary.total > 0 ? (tx.amount / tertiary.total) * 100 : 0;
                                      return (
                                        <div key={idx} className="flex items-center gap-3 py-2 px-3 hover:bg-muted/10 rounded transition-colors">
                                          <span className="text-sm text-muted-foreground w-20 flex-shrink-0">{tx.date}</span>
                                          <div className="flex-1"></div>
                                          {/* Progress Bar */}
                                          <div className="w-32 flex-shrink-0">
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                              <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                  width: `${txPercentage}%`,
                                                  backgroundColor: colorHex,
                                                  opacity: 0.4
                                                }}
                                              />
                                            </div>
                                          </div>
                                          <span className="text-sm text-right w-28 flex-shrink-0">¥{tx.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
