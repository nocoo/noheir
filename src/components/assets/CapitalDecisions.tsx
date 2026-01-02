/**
 * Capital Decisions Component
 *
 * "Action Center for Capital" - Centralized view of units requiring action
 * Shows idle funds, maturing products, and other items needing attention
 */

import { useState, useMemo } from 'react';
import { useUnitsDisplay, useProducts, useUpdateUnit, useDeployUnit, useRecallUnit } from '@/hooks/useAssets';
import type { DeployUnitInput, UpdateCapitalUnitInput } from '@/types/assets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/chart-config';
import { StatusBadge, UnitCodeBadge, StrategyBadge } from '@/components/ui/colored-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UnifiedEditDeployDialog } from './CapitalUnitsManager';
import type { UnitDisplay, Currency, InvestmentStrategy } from '@/types/assets';

// ============================================================================
// TYPES
// ============================================================================

interface DecisionItem {
  unit: UnitDisplay;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  details: string;
}

type SortColumn = '番号' | '策略' | '紧急度' | '说明';
type SortDirection = 'asc' | 'desc' | null;

// ============================================================================
// DECISION CLASSIFICATION
// ============================================================================

function classifyDecisions(units: UnitDisplay[]): DecisionItem[] {
  const decisions: DecisionItem[] = [];
  const today = new Date();

  units.forEach(unit => {
    // 0. 待成立：计划中状态，优先级低
    if (unit.status === '计划中') {
      decisions.push({
        unit,
        reason: '待成立',
        urgency: 'low',
        details: `资金正在筹集中，目标金额 ${formatCurrencyFull(unit.amount)}`,
      });
      return;
    }

    // 跳过非已成立状态
    if (unit.status !== '已成立') return;

    // 1. 闲置：未关联产品
    if (!unit.product) {
      decisions.push({
        unit,
        reason: '待投放',
        urgency: 'high',
        details: '资金已到位但未配置任何产品',
      });
      return;
    }

    // 2. 闲置：关联现金+类产品
    if (unit.product.category === '现金+') {
      decisions.push({
        unit,
        reason: '待再配置',
        urgency: 'medium',
        details: `当前在"${unit.product.name}"，建议配置到固定收益产品`,
      });
      return;
    }

    // 3. ✅ BEST: 已过锁定期（资金可用+持续产生收益）
    if (unit.is_available) {
      decisions.push({
        unit,
        reason: '已可用',
        urgency: 'low',  // No urgency - already in best state
        details: `"${unit.product.name}"锁定期已过，资金可用且持续产生收益，可灵活再配置`,
      });
      return;
    }

    // 4. 即将解锁（7天内）
    if (unit.days_until_maturity !== undefined && unit.days_until_maturity <= 7) {
      const daysText = unit.days_until_maturity === 0 ? '今日' :
                       unit.days_until_maturity === 1 ? '明日' :
                       `${unit.days_until_maturity}天后`;
      decisions.push({
        unit,
        reason: '即将解锁',
        urgency: 'high',
        details: `"${unit.product.name}"${daysText}解锁，金额 ${formatCurrencyFull(unit.amount)}，可规划再配置`,
      });
      return;
    }

    // 5. 即将解锁（30天内）
    if (unit.days_until_maturity !== undefined && unit.days_until_maturity <= 30) {
      decisions.push({
        unit,
        reason: '即将解锁',
        urgency: 'medium',
        details: `"${unit.product.name}" ${unit.days_until_maturity}天后解锁，可提前规划再配置`,
      });
      return;
    }
  });

  // 按紧急程度排序
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  return decisions.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.unit.unit_code.localeCompare(b.unit.unit_code, 'zh-CN');
  });
}

// ============================================================================
// URGENCY BADGE
// ============================================================================

interface UrgencyBadgeProps {
  urgency: 'high' | 'medium' | 'low';
}

function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  const config = {
    high: { label: '紧急', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
    medium: { label: '中等', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    low: { label: '低', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  };

  const { label, className } = config[urgency];

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  );
}

// ============================================================================
// CURRENCY EMOJI
// ============================================================================

const CURRENCY_EMOJI: Record<Currency, string> = {
  CNY: '🇨🇳',
  USD: '🇺🇸',
  HKD: '🇭🇰',
};

// ============================================================================
// STATS CARDS
// ============================================================================

interface StatsCardsProps {
  decisions: DecisionItem[];
}

function StatsCards({ decisions }: StatsCardsProps) {
  const stats = useMemo(() => {
    const byUrgency = {
      high: decisions.filter(d => d.urgency === 'high'),
      medium: decisions.filter(d => d.urgency === 'medium'),
      low: decisions.filter(d => d.urgency === 'low'),
    };

    const totalAmount = decisions.reduce((sum, d) => sum + d.unit.amount, 0);

    return {
      total: decisions.length,
      totalAmount,
      high: byUrgency.high.length,
      medium: byUrgency.medium.length,
      low: byUrgency.low.length,
      highAmount: byUrgency.high.reduce((sum, d) => sum + d.unit.amount, 0),
    };
  }, [decisions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 总需决策 */}
      <div className="border rounded-xl p-4 space-y-2">
        <p className="text-sm text-muted-foreground">需决策项目</p>
        <p className="text-2xl font-bold">{stats.total}</p>
        <p className="text-xs text-muted-foreground">
          总金额 {formatCurrencyFull(stats.totalAmount)}
        </p>
      </div>

      {/* 紧急 */}
      <div className="border border-rose-500/30 rounded-xl p-4 space-y-2 bg-rose-500/5">
        <p className="text-sm text-rose-600 dark:text-rose-400">紧急</p>
        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.high}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrencyFull(stats.highAmount)}
        </p>
      </div>

      {/* 中等 */}
      <div className="border border-amber-500/30 rounded-xl p-4 space-y-2 bg-amber-500/5">
        <p className="text-sm text-amber-600 dark:text-amber-400">中等</p>
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.medium}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrencyFull(
            decisions.filter(d => d.urgency === 'medium').reduce((sum, d) => sum + d.unit.amount, 0)
          )}
        </p>
      </div>

      {/* 低 */}
      <div className="border border-slate-500/30 rounded-xl p-4 space-y-2 bg-slate-500/5">
        <p className="text-sm text-muted-foreground">低</p>
        <p className="text-2xl font-bold">{stats.low}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrencyFull(
            decisions.filter(d => d.urgency === 'low').reduce((sum, d) => sum + d.unit.amount, 0)
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// FILTER BUTTONS
// ============================================================================

interface FilterButtonsProps {
  activeFilter: 'all' | 'high' | 'medium' | 'low';
  onFilterChange: (filter: 'all' | 'high' | 'medium' | 'low') => void;
  counts: { all: number; high: number; medium: number; low: number };
}

function FilterButtons({ activeFilter, onFilterChange, counts }: FilterButtonsProps) {
  const filters = [
    { value: 'all' as const, label: '全部', count: counts.all },
    { value: 'high' as const, label: '紧急', count: counts.high },
    { value: 'medium' as const, label: '中等', count: counts.medium },
    { value: 'low' as const, label: '低', count: counts.low },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(filter => (
        <Button
          key={filter.value}
          variant={activeFilter === filter.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(filter.value)}
          className="gap-2"
        >
          {filter.label}
          <Badge variant={activeFilter === filter.value ? 'secondary' : 'outline'} className="text-xs">
            {filter.count}
          </Badge>
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN DECISIONS COMPONENT
// ============================================================================

export function CapitalDecisions() {
  const { data: units, isLoading } = useUnitsDisplay();
  const { data: products } = useProducts();
  const updateMutation = useUpdateUnit();
  const deployMutation = useDeployUnit();
  const recallMutation = useRecallUnit();

  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Edit dialog state
  const [editDeployDialog, setEditDeployDialog] = useState<{
    open: boolean;
    unit?: UnitDisplay;
  }>({ open: false });

  const decisions = useMemo(() => {
    if (!units) return [];
    return classifyDecisions(units);
  }, [units]);

  const filteredDecisions = useMemo(() => {
    let result = activeFilter === 'all' ? decisions : decisions.filter(d => d.urgency === activeFilter);

    // Apply sorting
    if (sortColumn && sortDirection) {
      result = [...result].sort((a, b) => {
        let compareValue = 0;
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        switch (sortColumn) {
          case '番号':
            compareValue = a.unit.unit_code.localeCompare(b.unit.unit_code, 'zh-CN');
            break;
          case '策略':
            compareValue = a.unit.strategy.localeCompare(b.unit.strategy, 'zh-CN');
            break;
          case '紧急度':
            compareValue = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            break;
          case '说明':
            compareValue = a.details.localeCompare(b.details, 'zh-CN');
            break;
        }
        return sortDirection === 'asc' ? compareValue : -compareValue;
      });
    }

    return result;
  }, [decisions, activeFilter, sortColumn, sortDirection]);

  const counts = useMemo(() => ({
    all: decisions.length,
    high: decisions.filter(d => d.urgency === 'high').length,
    medium: decisions.filter(d => d.urgency === 'medium').length,
    low: decisions.filter(d => d.urgency === 'low').length,
  }), [decisions]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      // New column, set to asc
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-4 h-4 inline ml-1" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 inline ml-1" />
      : <ArrowDown className="w-4 h-4 inline ml-1" />;
  };

  // Unified handler for edit/deploy
  const handleEditDeploy = (unitData: UpdateCapitalUnitInput, deployData?: DeployUnitInput) => {
    if (!editDeployDialog.unit) return;

    // If there's deployment data with a product, ONLY deploy with strategy/tactics
    if (deployData && deployData.product_id) {
      deployMutation.mutate(
        {
          unitId: editDeployDialog.unit.id,
          input: {
            ...deployData,
            strategy: unitData.strategy,
            tactics: unitData.tactics,
          }
        },
        {
          onSuccess: () => {
            setEditDeployDialog({ open: false });
          },
        }
      );
    } else {
      // Only update unit info (no deployment change)
      updateMutation.mutate(
        { id: editDeployDialog.unit.id, input: unitData },
        {
          onSuccess: () => {
            setEditDeployDialog({ open: false });
          },
        }
      );
    }
  };

  const handleRecallFromDialog = () => {
    if (!editDeployDialog.unit) return;
    recallMutation.mutate(editDeployDialog.unit.id, {
      onSuccess: () => {
        setEditDeployDialog({ open: false });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">资金决策</h1>
          <p className="text-muted-foreground">集中展示需要操作的资金及原因</p>
        </div>
      </div>

      {/* Empty State */}
      {decisions.length === 0 ? (
        <div className="border rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-semibold mb-2">一切正常</h3>
          <p className="text-muted-foreground">
            当前没有需要特别关注的资金项目
          </p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <StatsCards decisions={decisions} />

          {/* Filters */}
          <div className="flex items-center justify-between">
            <FilterButtons
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              counts={counts}
            />
          </div>

          {/* Decision Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort('紧急度')}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      紧急度
                      {getSortIcon('紧急度')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('番号')}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      番号
                      {getSortIcon('番号')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('策略')}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      策略
                      {getSortIcon('策略')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('说明')}
                      className="flex items-center hover:text-foreground transition-colors"
                    >
                      说明
                      {getSortIcon('说明')}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDecisions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      该筛选条件下没有项目
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDecisions.map(item => (
                    <TableRow key={item.unit.id}>
                      {/* 紧急度 */}
                      <TableCell>
                        <UrgencyBadge urgency={item.urgency} />
                      </TableCell>

                      {/* 番号 */}
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-2">
                                <UnitCodeBadge unitCode={item.unit.unit_code} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {(() => {
                                  const currencySymbol = {
                                    CNY: '¥',
                                    USD: '$',
                                    HKD: 'HK$',
                                  }[item.unit.currency];
                                  return `${currencySymbol}${item.unit.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                })()}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>

                      {/* 策略 */}
                      <TableCell>
                        <StrategyBadge strategy={item.unit.strategy} />
                      </TableCell>

                      {/* 说明 */}
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{item.details}</p>
                      </TableCell>

                      {/* 操作 */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditDeployDialog({ open: true, unit: item.unit })}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Edit/Deploy Dialog */}
          <UnifiedEditDeployDialog
            open={editDeployDialog.open}
            onClose={() => setEditDeployDialog({ open: false })}
            onUnitUpdate={(data) => handleEditDeploy(data)}
            onDeployConfirm={(data) => handleEditDeploy({}, data)}
            onRecall={handleRecallFromDialog}
            unit={editDeployDialog.unit || null}
            products={products || []}
            isPending={updateMutation.isPending || deployMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
