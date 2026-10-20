import { Button, LayerCard } from "@nocoo/basalt";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useMemo, useState } from "react";

/** Transaction entry within a tertiary category */
export interface CategoryTransaction {
  date: string;
  amount: number;
}

/** Tertiary (3rd-level) category */
export interface TertiaryCategory {
  name: string;
  total: number;
  transactions?: CategoryTransaction[] | undefined;
}

/** Secondary (2nd-level) category */
export interface SecondaryCategory {
  name: string;
  total: number;
  tertiaryList: TertiaryCategory[];
}

/** Primary (1st-level) category group */
export interface PrimaryCategoryGroup {
  primary: string;
  total: number;
  percentage: number;
  secondaryCategories: SecondaryCategory[];
}

export interface CategoryDetailListProps {
  title: string;
  description: string;
  detailList: PrimaryCategoryGroup[];
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
  colors,
}: CategoryDetailListProps) {
  const initialCollapsed = useMemo(() => {
    const allKeys = new Set<string>();

    for (const cat of detailList) {
      for (const sub of cat.secondaryCategories) {
        allKeys.add(`${cat.primary}-${sub.name}`);
        for (const tertiary of sub.tertiaryList) {
          allKeys.add(`${cat.primary}-${sub.name}-${tertiary.name}`);
        }
      }
    }

    return allKeys;
  }, [detailList]);

  const [collapsed, setCollapsed] = useState<Set<string>>(initialCollapsed);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const safeColors = colors.length > 0 ? colors : ["#64748b"];

  return (
    <LayerCard>
      <LayerCard.Header className="items-stretch flex-col gap-1.5">
        <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2">
          <FileText className="text-basalt-primary size-5" />
          {title}
        </h3>
        <p className="text-sm text-basalt-muted-foreground">{description}</p>
      </LayerCard.Header>
      <LayerCard.Body className="min-h-0 flex-1">
        <div className="space-y-4">
          {detailList.map((cat, i) => {
            const primaryColor = safeColors[i % safeColors.length] ?? safeColors[0] ?? "#64748b";
            return (
              <div key={cat.primary} className="overflow-hidden rounded-lg">
                {/* Primary Category Row */}
                <div className="bg-basalt-muted/20 flex items-center gap-3 px-3 py-2">
                  <div
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span className="flex-1 font-medium">{cat.primary}</span>
                  <div className="w-32 shrink-0">
                    <div className="bg-basalt-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: primaryColor,
                        }}
                      />
                    </div>
                  </div>
                  <span className={`w-28 shrink-0 text-right font-semibold ${colorClass}`}>
                    ¥
                    {cat.total.toLocaleString("zh-CN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* Secondary Categories */}
                {cat.secondaryCategories.length > 0 && (
                  <div className="ml-6 mt-2 space-y-1">
                    {cat.secondaryCategories.map((sub) => {
                      const secondaryKey = `${cat.primary}-${sub.name}`;
                      const isSubCollapsed = collapsed.has(secondaryKey);
                      const subPercentage = cat.total > 0 ? (sub.total / cat.total) * 100 : 0;

                      return (
                        <div key={sub.name} className="overflow-hidden rounded-lg">
                          <Button
                            type="button"
                            variant="ghost"
                            aria-expanded={!isSubCollapsed}
                            onClick={() => toggleCollapse(secondaryKey)}
                            className="w-full justify-start gap-3 text-left"
                          >
                            <div className="shrink-0">
                              {isSubCollapsed ? (
                                <ChevronRight className="text-basalt-muted-foreground size-4" />
                              ) : (
                                <ChevronDown className="text-basalt-muted-foreground size-4" />
                              )}
                            </div>
                            <span className="text-basalt-muted-foreground flex-1 text-sm font-medium">
                              {sub.name}
                            </span>
                            <div className="w-32 shrink-0">
                              <div className="bg-basalt-muted h-2 overflow-hidden rounded-full">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${subPercentage}%`,
                                    backgroundColor: colorHex,
                                  }}
                                />
                              </div>
                            </div>
                            <span className={`w-28 shrink-0 text-right text-sm ${colorClass}`}>
                              ¥
                              {sub.total.toLocaleString("zh-CN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </Button>

                          {/* Tertiary Categories */}
                          {!isSubCollapsed && sub.tertiaryList.length > 0 && (
                            <div className="ml-8 space-y-1">
                              {sub.tertiaryList.map((tertiary) => {
                                const tertiaryKey = `${cat.primary}-${sub.name}-${tertiary.name}`;
                                const isTertiaryCollapsed = collapsed.has(tertiaryKey);
                                const tertiaryPercentage =
                                  sub.total > 0 ? (tertiary.total / sub.total) * 100 : 0;

                                return (
                                  <div key={tertiary.name} className="overflow-hidden rounded-lg">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      aria-expanded={!isTertiaryCollapsed}
                                      onClick={() => toggleCollapse(tertiaryKey)}
                                      className="w-full justify-start gap-3 text-left"
                                    >
                                      <div className="shrink-0">
                                        {isTertiaryCollapsed ? (
                                          <ChevronRight className="text-basalt-muted-foreground size-4" />
                                        ) : (
                                          <ChevronDown className="text-basalt-muted-foreground size-4" />
                                        )}
                                      </div>
                                      <span className="text-basalt-muted-foreground flex-1 text-sm">
                                        {tertiary.name}
                                      </span>
                                      <div className="w-32 shrink-0">
                                        <div className="bg-basalt-muted h-2 overflow-hidden rounded-full">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${tertiaryPercentage}%`,
                                              backgroundColor: colorHex,
                                              opacity: 0.7,
                                            }}
                                          />
                                        </div>
                                      </div>
                                      <span
                                        className={`w-28 shrink-0 text-right text-sm ${colorClass}`}
                                      >
                                        ¥
                                        {tertiary.total.toLocaleString("zh-CN", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </Button>

                                    {/* Transactions */}
                                    {!isTertiaryCollapsed &&
                                      tertiary.transactions?.map((tx, idx) => {
                                        const txPercentage =
                                          tertiary.total > 0
                                            ? (tx.amount / tertiary.total) * 100
                                            : 0;
                                        return (
                                          <div
                                            // biome-ignore lint/suspicious/noArrayIndexKey: CategoryTransaction has no stable id; date+amount can collide
                                            key={`${tx.date}-${idx}`}
                                            className="hover:bg-basalt-muted/10 flex items-center gap-3 rounded px-3 py-2 transition-colors"
                                          >
                                            <span className="text-basalt-muted-foreground w-20 shrink-0 text-sm">
                                              {tx.date}
                                            </span>
                                            <div className="flex-1" />
                                            <div className="w-32 shrink-0">
                                              <div className="bg-basalt-muted h-2 overflow-hidden rounded-full">
                                                <div
                                                  className="h-full rounded-full transition-all"
                                                  style={{
                                                    width: `${txPercentage}%`,
                                                    backgroundColor: colorHex,
                                                    opacity: 0.4,
                                                  }}
                                                />
                                              </div>
                                            </div>
                                            <span
                                              className={`w-28 shrink-0 text-right text-sm ${colorClass}`}
                                            >
                                              ¥
                                              {tx.amount.toLocaleString("zh-CN", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              })}
                                            </span>
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
      </LayerCard.Body>
    </LayerCard>
  );
}
