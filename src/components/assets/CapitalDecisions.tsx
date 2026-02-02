/**
 * Capital Decisions Component
 *
 * "Action Center for Capital" - Centralized view of units requiring action
 * Shows idle funds, maturing products, and other items needing attention
 */

import { useMemo } from 'react';
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
import type { Currency, InvestmentStrategy, UnitDisplayInfo } from '@/types/assets';
import { buildDecisionStats, buildCurrencyTooltip } from '@/domain/assets/capitalDecisions';
import { useCapitalDecisionsViewModel } from '@/viewmodels/assets/useCapitalDecisionsViewModel';

// ============================================================================
// TYPES
// ============================================================================

interface DecisionItem {
  unit: UnitDisplayInfo;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  details: string;
}

type SortColumn = '番号' | '策略' | '紧急度' | '说明';

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
  stats: ReturnType<typeof buildDecisionStats>;
  decisions: DecisionItem[];
}

function StatsCards({ stats, decisions }: StatsCardsProps) {

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
  const {
    products,
    isLoading,
    decisions,
    filteredDecisions,
    counts,
    activeFilter,
    setActiveFilter,
    sortColumn,
    sortDirection,
    handleSort,
    editDeployDialog,
    setEditDeployDialog,
    handleEditDeploy,
    handleRecallFromDialog,
    updateMutation,
    deployMutation,
  } = useCapitalDecisionsViewModel();

  const stats = useMemo(() => buildDecisionStats(decisions), [decisions]);

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-4 h-4 inline ml-1" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 inline ml-1" />
      : <ArrowDown className="w-4 h-4 inline ml-1" />;
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
          <StatsCards decisions={decisions} stats={stats} />

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
                  <TableHead className="h-10 px-3">
                    <button
                      onClick={() => handleSort('紧急度')}
                      className="flex items-center hover:text-foreground transition-colors text-sm"
                    >
                      紧急度
                      {getSortIcon('紧急度')}
                    </button>
                  </TableHead>
                  <TableHead className="h-10 px-3">
                    <button
                      onClick={() => handleSort('番号')}
                      className="flex items-center hover:text-foreground transition-colors text-sm"
                    >
                      番号
                      {getSortIcon('番号')}
                    </button>
                  </TableHead>
                  <TableHead className="h-10 px-3">
                    <button
                      onClick={() => handleSort('策略')}
                      className="flex items-center hover:text-foreground transition-colors text-sm"
                    >
                      策略
                      {getSortIcon('策略')}
                    </button>
                  </TableHead>
                  <TableHead className="h-10 px-3">
                    <button
                      onClick={() => handleSort('说明')}
                      className="flex items-center hover:text-foreground transition-colors text-sm"
                    >
                      说明
                      {getSortIcon('说明')}
                    </button>
                  </TableHead>
                  <TableHead className="h-10 px-3 text-right">操作</TableHead>
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
                      <TableCell className="py-2 px-3">
                        <UrgencyBadge urgency={item.urgency} />
                      </TableCell>

                      {/* 番号 */}
                      <TableCell className="py-2 px-3 font-medium">
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
                      <TableCell className="py-2 px-3">
                        <StrategyBadge strategy={item.unit.strategy} />
                      </TableCell>

                      {/* 说明 */}
                      <TableCell className="py-2 px-3">
                        <div className="space-y-0.5">
                          <p className="text-sm text-muted-foreground">{item.details}</p>
                          {item.unit.note && (
                            <p className="text-xs text-muted-foreground italic">
                              📝 {item.unit.note}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* 操作 */}
                      <TableCell className="py-2 px-3 text-right">
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
