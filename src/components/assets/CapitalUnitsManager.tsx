/**
 * Capital Units Manager Component
 *
 * CRUD interface for managing Capital Units
 */

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  useUnitsDisplay,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useDeployUnit,
  useRecallUnit,
  useArchiveUnit,
  useProducts,
} from '@/hooks/useAssets';
import { Plus, Pencil, Trash2, Coins, ArrowRight, Undo, Archive, Filter, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  UnitCodeBadge,
  StrategyBadge,
  TacticsBadge,
  StatusBadge,
} from '@/components/ui/colored-badge';
import type {
  CapitalUnit,
  FinancialProduct,
  CreateCapitalUnitInput,
  UpdateCapitalUnitInput,
  DeployUnitInput,
  Currency,
  InvestmentStrategy,
  InvestmentTactics,
  UnitStatus,
  UnitFilters,
  UnitDisplayInfo,
} from '@/types/assets';
import { formatCurrencyFull } from '@/lib/chart-config';

// Enum options
const STRATEGY_OPTIONS: { value: InvestmentStrategy; label: string }[] = [
  { value: '远期理财', label: '远期理财' },
  { value: '美元资产', label: '美元资产' },
  { value: '36存单', label: '36存单' },
  { value: '长期理财', label: '长期理财' },
  { value: '短期理财', label: '短期理财' },
  { value: '中期理财', label: '中期理财' },
  { value: '进攻计划', label: '进攻计划' },
  { value: '麻麻理财', label: '麻麻理财' },
];

const TACTICS_OPTIONS: { value: InvestmentTactics; label: string }[] = [
  { value: '养老年金', label: '养老年金' },
  { value: '个人养老金', label: '个人养老金' },
  { value: '定期存款', label: '定期存款' },
  { value: '理财产品', label: '理财产品' },
  { value: '现金产品', label: '现金产品' },
  { value: '债券基金', label: '债券基金' },
  { value: '偏股基金', label: '偏股基金' },
  { value: '稳健理财', label: '稳健理财' },
  { value: '增额寿险', label: '增额寿险' },
  { value: '货币基金', label: '货币基金' },
];

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'CNY', label: '人民币 CNY' },
  { value: 'USD', label: '美元 USD' },
  { value: 'HKD', label: '港币 HKD' },
];

// Amount options for unit creation
const AMOUNT_OPTIONS = [10000, 50000];

// Strategy to unit code prefix mapping
const STRATEGY_CODE_PREFIX: Record<InvestmentStrategy, string> = {
  '远期理财': 'A',  // Default: A01, A02...
  '美元资产': 'M',
  '36存单': 'R',
  '长期理财': 'B',
  '短期理财': 'E',
  '中期理财': 'C',
  '进攻计划': 'D',
  '麻麻理财': 'Q',
};

// Special case: 个人养老金 under 远期理财 uses 'Y' prefix
const TACTICS_PENSION_PREFIX = 'Y';

const STATUS_OPTIONS: { value: UnitStatus; label: string }[] = [
  { value: '已成立', label: '已成立' },
  { value: '计划中', label: '计划中' },
  { value: '筹集中', label: '筹集中' },
  { value: '已归档', label: '已归档' },
];

// Status badge variant mapping
const getStatusVariant = (status: UnitStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case '已成立':
      return 'default';
    case '计划中':
      return 'outline';
    case '筹集中':
      return 'outline';
    case '已归档':
      return 'destructive';
    default:
      return 'outline';
  }
};

// Get display status based on end_date
// If unit has end_date, it shows as "锁定期" (locked) visually
const getDisplayStatus = (unit: UnitDisplayInfo): { status: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  if (unit.status === '已归档') {
    return { status: '已归档', variant: 'destructive' };
  }
  if (unit.status === '计划中') {
    return { status: '计划中', variant: 'outline' };
  }
  if (unit.status === '筹集中') {
    return { status: '筹集中', variant: 'outline' };
  }
  // For '已成立' units, check if they have an end_date (locked/invested)
  if (unit.end_date) {
    if (unit.is_overdue) {
      return { status: '已到期', variant: 'destructive' };
    }
    if (unit.days_until_maturity !== undefined && unit.days_until_maturity <= 7) {
      return { status: '即将到期', variant: 'secondary' };
    }
    return { status: '锁定期', variant: 'default' };
  }
  return { status: '已成立', variant: 'default' };
};

interface UnitFormProps {
  unit?: CapitalUnit;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCapitalUnitInput | UpdateCapitalUnitInput) => void;
  isPending?: boolean;
}

function UnitForm({ unit, open, onClose, onSubmit, isPending }: UnitFormProps) {
  const isEdit = !!unit;
  const [formData, setFormData] = useState<CreateCapitalUnitInput>(
    unit
      ? {
          unit_code: unit.unit_code,
          amount: unit.amount,
          currency: unit.currency,
          status: unit.status,
          strategy: unit.strategy,
          tactics: unit.tactics,
        }
      : {
          unit_code: '',
          amount: 0,
          currency: 'CNY',
          status: '已成立',
          strategy: '长期理财',
          tactics: '稳健理财',
        }
  );

  const [codeSuffix, setCodeSuffix] = useState('');

  // Sync formData when unit prop changes (e.g., when editing different units)
  useEffect(() => {
    if (unit) {
      setFormData({
        unit_code: unit.unit_code,
        amount: unit.amount,
        currency: unit.currency,
        status: unit.status,
        strategy: unit.strategy,
        tactics: unit.tactics,
      });
    } else {
      setFormData({
        unit_code: '',
        amount: 0,
        currency: 'CNY',
        status: '已成立',
        strategy: '长期理财',
        tactics: '稳健理财',
      });
    }
  }, [unit]);

  // Get the unit code prefix based on strategy and tactics
  const getCodePrefix = (): string => {
    // Special case: 个人养老金 uses 'Y' prefix
    if (formData.strategy === '远期理财' && formData.tactics === '个人养老金') {
      return TACTICS_PENSION_PREFIX;
    }
    return STRATEGY_CODE_PREFIX[formData.strategy];
  };

  // Full unit code (prefix + suffix)
  const fullUnitCode = isEdit
    ? formData.unit_code
    : codeSuffix
      ? `${getCodePrefix()}${codeSuffix}`
      : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For new units, construct the full unit code
    const submitData = isEdit
      ? formData
      : {
          ...formData,
          unit_code: fullUnitCode,
        };
    onSubmit(submitData);
    if (!isPending) {
      onClose();
    }
  };

  const updateField = <K extends keyof CreateCapitalUnitInput>(
    key: K,
    value: CreateCapitalUnitInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑资金单元' : '新增资金单元'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改资金单元信息' : '创建新的资金单元'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Strategy */}
            <div className="space-y-2">
              <Label htmlFor="strategy">
                投资策略 <span className="text-expense">*</span>
              </Label>
              <Select
                value={formData.strategy}
                onValueChange={(value: InvestmentStrategy) => updateField('strategy', value)}
              >
                <SelectTrigger id="strategy">
                  <SelectValue placeholder="选择投资策略" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tactics */}
            <div className="space-y-2">
              <Label htmlFor="tactics">
                投资战术 <span className="text-expense">*</span>
              </Label>
              <Select
                value={formData.tactics}
                onValueChange={(value: InvestmentTactics) => updateField('tactics', value)}
              >
                <SelectTrigger id="tactics">
                  <SelectValue placeholder="选择投资战术" />
                </SelectTrigger>
                <SelectContent>
                  {TACTICS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">币种</Label>
              <Select
                value={formData.currency}
                onValueChange={(value: Currency) => updateField('currency', value)}
                disabled={isEdit} // Currency is immutable
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="选择币种" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount - dropdown selection for new units */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                金额 <span className="text-expense">*</span>
              </Label>
              {isEdit ? (
                // Edit mode: show as text display
                <div className="text-sm font-medium">{formatCurrencyFull(formData.amount)}</div>
              ) : (
                // Create mode: dropdown selection
                <Select
                  value={formData.amount.toString()}
                  onValueChange={(value) => updateField('amount', parseInt(value))}
                >
                  <SelectTrigger id="amount">
                    <SelectValue placeholder="选择金额" />
                  </SelectTrigger>
                  <SelectContent>
                    {AMOUNT_OPTIONS.map((amount) => (
                      <SelectItem key={amount} value={amount.toString()}>
                        {formatCurrencyFull(amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Unit Code */}
            <div className="space-y-2">
              <Label htmlFor="unit_code">
                番号 <span className="text-expense">*</span>
              </Label>
              {isEdit ? (
                // Edit mode: show existing code
                <Input
                  id="unit_code"
                  value={formData.unit_code}
                  disabled
                  className="font-mono bg-muted"
                />
              ) : (
                // Create mode: prefix (readonly) + suffix input
                <div className="flex items-center gap-2">
                  <Input
                    value={getCodePrefix()}
                    disabled
                    className="font-mono w-16 bg-muted text-center"
                    placeholder="A"
                  />
                  <Input
                    id="unit_code_suffix"
                    type="text"
                    value={codeSuffix}
                    onChange={e => setCodeSuffix(e.target.value)}
                    placeholder="01"
                    required
                    className="font-mono flex-1"
                    maxLength={3}
                  />
                  <div className="text-sm text-muted-foreground min-w-16">
                    {fullUnitCode && <span>= {fullUnitCode}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Status - only show in edit mode */}
            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: UnitStatus) => updateField('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '提交中...' : isEdit ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Unified Edit & Deploy Dialog
 * Left panel: Edit unit information
 * Right panel: Edit deployment information
 */
interface UnifiedEditDeployDialogProps {
  open: boolean;
  onClose: () => void;
  onUnitUpdate: (data: UpdateCapitalUnitInput) => void;
  onDeployConfirm: (data: DeployUnitInput) => void;
  onRecall: () => void;
  unit: UnitDisplayInfo | null;
  products: FinancialProduct[];
  isPending?: boolean;
}

function UnifiedEditDeployDialog({
  open,
  onClose,
  onUnitUpdate,
  onDeployConfirm,
  onRecall,
  unit,
  products,
  isPending,
}: UnifiedEditDeployDialogProps) {
  // Unit info state
  const [formData, setFormData] = useState<UpdateCapitalUnitInput>({
    strategy: unit?.strategy || '长期理财',
    tactics: unit?.tactics || '稳健理财',
    status: unit?.status || '已成立',
  });

  // Deploy info state
  const [productId, setProductId] = useState<string>(unit?.product_id || '');
  const [startDate, setStartDate] = useState<string>(
    unit?.start_date || format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    unit?.end_date || ''
  );

  // Sync form data when unit changes
  useEffect(() => {
    if (unit) {
      setFormData({
        strategy: unit.strategy,
        tactics: unit.tactics,
        status: unit.status,
      });
      setProductId(unit.product_id || '');
      setStartDate(unit.start_date || format(new Date(), 'yyyy-MM-dd'));
      setEndDate(unit.end_date || '');
    }
  }, [unit]);

  // Auto-calculate end date based on product lock period
  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    const product = products.find(p => p.id === productId);
    if (product && product.lock_period_days > 0) {
      const start = new Date(date);
      const end = new Date(start);
      end.setDate(end.getDate() + product.lock_period_days);
      setEndDate(format(end, 'yyyy-MM-dd'));
    }
  };

  // Update end date when product changes
  const handleProductChange = (id: string) => {
    setProductId(id);
    if (startDate) {
      const product = products.find(p => p.id === id);
      if (product && product.lock_period_days > 0) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + product.lock_period_days);
        setEndDate(format(end, 'yyyy-MM-dd'));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Update unit info
    onUnitUpdate(formData);

    // Update deployment info if product is selected
    if (productId) {
      onDeployConfirm({
        product_id: productId,
        start_date: startDate,
        end_date: endDate,
      });
    } else if (!isPending) {
      // No product selected, just close after unit update
      onClose();
    }
  };

  const updateField = <K extends keyof UpdateCapitalUnitInput>(
    key: K,
    value: UpdateCapitalUnitInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const isDeployed = !!unit?.end_date;

  // All products are available (no status filter needed)
  const availableProducts = products.slice().sort((a, b) => {
    const channelCompare = a.channel.localeCompare(b.channel, 'zh-CN');
    if (channelCompare !== 0) return channelCompare;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑资金单元 - {unit.unit_code}</DialogTitle>
          <DialogDescription>
            修改资金单元信息和投放配置
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Panel - Unit Information */}
            <div className="space-y-4 border-r pr-6">
              <h3 className="font-semibold text-lg">资金信息</h3>

              {/* Unit Code (readonly) */}
              <div className="space-y-2">
                <Label>番号</Label>
                <Input
                  value={unit.unit_code}
                  disabled
                  className="font-mono bg-muted"
                />
              </div>

              {/* Amount (readonly) */}
              <div className="space-y-2">
                <Label>金额</Label>
                <div className="text-sm font-medium">{formatCurrencyFull(unit.amount)}</div>
              </div>

              {/* Currency (readonly) */}
              <div className="space-y-2">
                <Label>币种</Label>
                <Input
                  value={unit.currency}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Strategy */}
              <div className="space-y-2">
                <Label htmlFor="edit_strategy">
                  投资策略 <span className="text-expense">*</span>
                </Label>
                <Select
                  value={formData.strategy}
                  onValueChange={(value: InvestmentStrategy) => updateField('strategy', value)}
                >
                  <SelectTrigger id="edit_strategy">
                    <SelectValue placeholder="选择投资策略" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tactics */}
              <div className="space-y-2">
                <Label htmlFor="edit_tactics">
                  投资战术 <span className="text-expense">*</span>
                </Label>
                <Select
                  value={formData.tactics}
                  onValueChange={(value: InvestmentTactics) => updateField('tactics', value)}
                >
                  <SelectTrigger id="edit_tactics">
                    <SelectValue placeholder="选择投资战术" />
                  </SelectTrigger>
                  <SelectContent>
                    {TACTICS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="edit_status">状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: UnitStatus) => updateField('status', value)}
                >
                  <SelectTrigger id="edit_status">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Created At (readonly) */}
              <div className="space-y-2 pt-4 border-t">
                <Label>创建时间</Label>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(unit.created_at), 'yyyy-MM-dd HH:mm:ss')}
                </div>
              </div>
            </div>

            {/* Right Panel - Deployment Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">投放配置</h3>
                <div className="flex gap-2">
                  {/* Quick Actions */}
                  {isDeployed && (
                    <>
                      {/* Renew button - for expired units */}
                      {unit.end_date && new Date(unit.end_date) <= new Date() && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            // Set start date to the expiration date
                            if (unit.end_date) {
                              const newStartDate = unit.end_date;
                              setStartDate(newStartDate);
                              // Auto-calculate end date based on current product
                              if (productId) {
                                const product = products.find(p => p.id === productId);
                                if (product && product.lock_period_days > 0) {
                                  const start = new Date(newStartDate);
                                  const end = new Date(start);
                                  end.setDate(end.getDate() + product.lock_period_days);
                                  setEndDate(format(end, 'yyyy-MM-dd'));
                                }
                              }
                            }
                          }}
                          disabled={isPending}
                          className="text-income hover:text-income hover:bg-income/10"
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          续作
                        </Button>
                      )}

                      {/* Recall button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          onRecall();
                        }}
                        disabled={isPending}
                      >
                        <Undo className="h-4 w-4 mr-1" />
                        召回
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Product Selection */}
              <div className="space-y-2">
                <Label htmlFor="deploy_product">
                  选择产品
                </Label>
                <Select value={productId} onValueChange={handleProductChange}>
                  <SelectTrigger id="deploy_product">
                    <SelectValue placeholder="选择要投放的产品" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.channel} - {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {productId && (
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const product = products.find(p => p.id === productId);
                      if (!product) return null;
                      return (
                        <div className="space-y-1">
                          <div>类别: {product.category}</div>
                          <div>锁定期: {product.lock_period_days} 天</div>
                          {product.annual_return_rate && (
                            <div>年化: {product.annual_return_rate}%</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="deploy_start_date">
                  开始日期
                </Label>
                <Input
                  id="deploy_start_date"
                  type="date"
                  value={startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="deploy_end_date">
                  结束日期
                </Label>
                <Input
                  id="deploy_end_date"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                />
                {endDate && startDate && (
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const start = new Date(startDate);
                      const end = new Date(endDate);
                      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      return `投资期限: ${days} 天`;
                    })()}
                  </div>
                )}
              </div>

              {/* Current Deployment Info */}
              {unit.product && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>当前投放</Label>
                  <div className="text-sm space-y-1">
                    <div><strong>产品:</strong> {unit.product.channel} - {unit.product.name}</div>
                    {unit.start_date && <div><strong>开始:</strong> {unit.start_date}</div>}
                    {unit.end_date && (
                      <div>
                        <strong>结束:</strong> {unit.end_date}
                        {unit.end_date && new Date(unit.end_date) <= new Date() && (
                          <span className="ml-2 text-xs text-expense">(已到期)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '保存中...' : '保存更改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  unitCode: string;
  isPending?: boolean;
}

function DeleteConfirmDialog({ open, onClose, onConfirm, unitCode, isPending }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除资金单元 <span className="font-semibold">"{unitCode}"</span> 吗？此操作无法撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? '删除中...' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ArchiveConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  unitCode: string;
  isPending?: boolean;
}

function ArchiveConfirmDialog({
  open,
  onClose,
  onConfirm,
  unitCode,
  isPending,
}: ArchiveConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认归档</DialogTitle>
          <DialogDescription>
            确定要归档资金单元 <span className="font-semibold">"{unitCode}"</span> 吗？
            归档后状态将变更为"已归档"，产品关联将被清除。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? '归档中...' : '确认归档'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { UnifiedEditDeployDialog };

export function CapitalUnitsManager() {
  const { data: units, isLoading } = useUnitsDisplay();
  const { data: products } = useProducts();
  const createMutation = useCreateUnit();
  const updateMutation = useUpdateUnit();
  const deleteMutation = useDeleteUnit();
  const deployMutation = useDeployUnit();
  const recallMutation = useRecallUnit();
  const archiveMutation = useArchiveUnit();

  // Filter state
  const [filterStatus, setFilterStatus] = useState<UnitStatus | 'all'>('all');
  const [filterStrategy, setFilterStrategy] = useState<InvestmentStrategy | 'all'>('all');
  const [filterTactics, setFilterTactics] = useState<InvestmentTactics | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort state
  type UnitSortField = 'unit_code' | 'amount' | 'currency' | 'strategy' | 'tactics' | 'status' | 'remaining_days';
  const [sortField, setSortField] = useState<UnitSortField>('unit_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filtered and sorted units
  const filteredUnits = useMemo(() => {
    if (!units) return [];

    // First filter
    let result = units.filter(unit => {
      if (filterStatus !== 'all' && unit.status !== filterStatus) return false;
      if (filterStrategy !== 'all' && unit.strategy !== filterStrategy) return false;
      if (filterTactics !== 'all' && unit.tactics !== filterTactics) return false;
      return true;
    });

    // Then sort
    result.sort((a, b) => {
      let compareA, compareB;

      switch (sortField) {
        case 'unit_code':
          compareA = a.unit_code;
          compareB = b.unit_code;
          break;
        case 'amount':
          compareA = a.amount;
          compareB = b.amount;
          break;
        case 'currency':
          compareA = a.currency;
          compareB = b.currency;
          break;
        case 'strategy':
          compareA = a.strategy;
          compareB = b.strategy;
          break;
        case 'tactics':
          compareA = a.tactics;
          compareB = b.tactics;
          break;
        case 'status':
          compareA = a.status;
          compareB = b.status;
          break;
        case 'remaining_days':
          const daysA = a.days_until_maturity ?? Infinity;
          const daysB = b.days_until_maturity ?? Infinity;
          compareA = daysA;
          compareB = daysB;
          break;
        default:
          compareA = a.unit_code;
          compareB = b.unit_code;
      }

      if (typeof compareA === 'string' && typeof compareB === 'string') {
        return sortOrder === 'asc'
          ? compareA.localeCompare(compareB, 'zh-CN')
          : compareB.localeCompare(compareA, 'zh-CN');
      }

      if (typeof compareA === 'number' && typeof compareB === 'number') {
        return sortOrder === 'asc' ? compareA - compareB : compareB - compareA;
      }

      return 0;
    });

    return result;
  }, [units, filterStatus, filterStrategy, filterTactics, sortField, sortOrder]);

  // Handle sort
  const handleSort = (field: UnitSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: UnitSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 inline ml-1" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-4 h-4 inline ml-1" />
      : <ArrowDown className="w-4 h-4 inline ml-1" />;
  };

  // Active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== 'all') count++;
    if (filterStrategy !== 'all') count++;
    if (filterTactics !== 'all') count++;
    return count;
  }, [filterStatus, filterStrategy, filterTactics]);

  // Reset filters
  const resetFilters = () => {
    setFilterStatus('all');
    setFilterStrategy('all');
    setFilterTactics('all');
    setShowFilters(false);
  };

  const [formDialog, setFormDialog] = useState<{
    open: boolean;
    unit?: CapitalUnit;
  }>({ open: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    unit?: CapitalUnit;
  }>({ open: false });

  // Unified edit/deploy dialog
  const [editDeployDialog, setEditDeployDialog] = useState<{
    open: boolean;
    unit?: UnitDisplayInfo;
  }>({ open: false });

  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    unit?: CapitalUnit;
  }>({ open: false });

  const handleCreate = (data: CreateCapitalUnitInput) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setFormDialog({ open: false });
      },
    });
  };

  const handleUpdate = (data: UpdateCapitalUnitInput) => {
    if (!formDialog.unit) return;
    updateMutation.mutate(
      { id: formDialog.unit.id, input: data },
      {
        onSuccess: () => {
          setFormDialog({ open: false });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteDialog.unit) return;
    deleteMutation.mutate(deleteDialog.unit.id, {
      onSuccess: () => {
        setDeleteDialog({ open: false });
      },
    });
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

  const handleRecall = (unitId: string) => {
    recallMutation.mutate(unitId);
  };

  const handleArchive = () => {
    if (!archiveDialog.unit) return;
    archiveMutation.mutate(archiveDialog.unit.id, {
      onSuccess: () => {
        setArchiveDialog({ open: false });
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
      {/* Header with Add button and Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">资金单元</h2>
          <span className="text-sm text-muted-foreground">
            ({filteredUnits?.length || 0} / {units?.length || 0} 个单元)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter button */}
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="w-4 h-4 mr-1" />
            筛选
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button onClick={() => setFormDialog({ open: true })} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            新增单元
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">筛选条件</h3>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="w-4 h-4 mr-1" />
              重置
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">状态</label>
              <Select
                value={filterStatus}
                onValueChange={(value: UnitStatus | 'all') => setFilterStatus(value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strategy Filter */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">策略</label>
              <Select
                value={filterStrategy}
                onValueChange={(value: InvestmentStrategy | 'all') => setFilterStrategy(value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部策略" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部策略</SelectItem>
                  {STRATEGY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tactics Filter */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">战术</label>
              <Select
                value={filterTactics}
                onValueChange={(value: InvestmentTactics | 'all') => setFilterTactics(value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部战术" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部战术</SelectItem>
                  {TACTICS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Units Table */}
      {filteredUnits && filteredUnits.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort('unit_code')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    番号
                    {getSortIcon('unit_code')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('strategy')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    策略
                    {getSortIcon('strategy')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('tactics')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    战术
                    {getSortIcon('tactics')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    状态
                    {getSortIcon('status')}
                  </button>
                </TableHead>
                <TableHead>关联产品</TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('remaining_days')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    剩余天数
                    {getSortIcon('remaining_days')}
                  </button>
                </TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.map(unit => {
                const displayStatus = getDisplayStatus(unit);
                return (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">
                              <UnitCodeBadge unitCode={unit.unit_code} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {(() => {
                                const currencySymbol = {
                                  CNY: '¥',
                                  USD: '$',
                                  HKD: 'HK$',
                                }[unit.currency];
                                return `${currencySymbol}${unit.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              })()}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <StrategyBadge strategy={unit.strategy} />
                    </TableCell>
                    <TableCell>
                      <TacticsBadge tactics={unit.tactics} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={displayStatus.status} />
                    </TableCell>
                    <TableCell>
                      {unit.product ? (
                        <div>
                          <div className="text-sm">{unit.product.name}</div>
                          <div className="text-xs text-muted-foreground">{unit.product.channel}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {unit.end_date && unit.days_until_maturity !== undefined ? (
                        <span
                          className={
                            unit.is_overdue
                              ? 'text-expense'
                              : unit.days_until_maturity <= 7
                                ? 'text-orange-500'
                                : ''
                          }
                        >
                        {unit.is_overdue
                          ? `逾期 ${Math.abs(unit.days_until_maturity)} 天`
                          : unit.days_until_maturity === 0
                            ? '今日到期'
                            : `${unit.days_until_maturity} 天`}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Unified Edit/Deploy button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditDeployDialog({ open: true, unit })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      {/* Delete button - only for archived units */}
                      {unit.status === '已归档' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-expense hover:text-expense hover:bg-expense/10"
                          onClick={() => setDeleteDialog({ open: true, unit })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <Coins className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">
            {activeFilterCount > 0 ? '没有符合筛选条件的资金单元' : '还没有创建任何资金单元'}
          </p>
          <Button onClick={() => setFormDialog({ open: true })}>
            <Plus className="w-4 h-4 mr-2" />
            {activeFilterCount > 0 ? '新增单元' : '创建第一个单元'}
          </Button>
        </div>
      )}

      {/* Form Dialog */}
      <UnitForm
        unit={formDialog.unit}
        open={formDialog.open}
        onClose={() => setFormDialog({ open: false })}
        onSubmit={formDialog.unit ? handleUpdate : handleCreate}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false })}
        onConfirm={handleDelete}
        unitCode={deleteDialog.unit?.unit_code || ''}
        isPending={deleteMutation.isPending}
      />

      {/* Unified Edit/Deploy Dialog */}
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

      {/* Archive Confirm Dialog */}
      <ArchiveConfirmDialog
        open={archiveDialog.open}
        onClose={() => setArchiveDialog({ open: false })}
        onConfirm={handleArchive}
        unitCode={archiveDialog.unit?.unit_code || ''}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}
