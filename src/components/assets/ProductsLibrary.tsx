/**
 * Products Library Component
 *
 * CRUD interface for managing Financial Products
 */

import { useState, useMemo, useEffect } from 'react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/useAssets';
import { Plus, Pencil, Trash2, Banknote, Filter, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type {
  FinancialProduct,
  CreateFinancialProductInput,
  UpdateFinancialProductInput,
  ProductChannel,
  ProductCategory,
  ProductStatus,
  Currency,
} from '@/types/assets';

// Enum options
const CHANNEL_OPTIONS: { value: ProductChannel; label: string }[] = [
  { value: '招商银行', label: '招商银行' },
  { value: '平安银行', label: '平安银行' },
  { value: '微众银行', label: '微众银行' },
  { value: '支付宝', label: '支付宝' },
  { value: '招银香港', label: '招银香港' },
  { value: '光大永明', label: '光大永明' },
  { value: '中信建投', label: '中信建投' },
];

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: '养老年金', label: '养老年金' },
  { value: '储蓄保险', label: '储蓄保险' },
  { value: '混债基金', label: '混债基金' },
  { value: '债券基金', label: '债券基金' },
  { value: '货币基金', label: '货币基金' },
  { value: '股票基金', label: '股票基金' },
  { value: '指数基金', label: '指数基金' },
  { value: '宽基指数', label: '宽基指数' },
  { value: '私募基金', label: '私募基金' },
  { value: '定期存款', label: '定期存款' },
  { value: '理财产品', label: '理财产品' },
  { value: '现金+', label: '现金+' },
];

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'CNY', label: '人民币 CNY' },
  { value: 'USD', label: '美元 USD' },
  { value: 'HKD', label: '港币 HKD' },
];

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: '投资中', label: '投资中' },
  { value: '已退出', label: '已退出' },
];

// Currency emoji mapping
const CURRENCY_EMOJI: Record<Currency, string> = {
  CNY: '🇨🇳',
  USD: '🇺🇸',
  HKD: '🇭🇰',
};

// Channel badge color variant
const getChannelVariant = (channel: ProductChannel): 'default' | 'secondary' | 'outline' => {
  const variants: Record<ProductChannel, 'default' | 'secondary' | 'outline'> = {
    '招商银行': 'default',
    '平安银行': 'secondary',
    '微众银行': 'outline',
    '支付宝': 'default',
    '招银香港': 'secondary',
    '光大永明': 'outline',
    '中信建投': 'default',
  };
  return variants[channel];
};

// Category badge color variant
const getCategoryVariant = (category: ProductCategory): 'default' | 'secondary' | 'outline' => {
  const variants: Record<ProductCategory, 'default' | 'secondary' | 'outline'> = {
    '养老年金': 'default',
    '储蓄保险': 'secondary',
    '混债基金': 'outline',
    '债券基金': 'default',
    '货币基金': 'secondary',
    '股票基金': 'outline',
    '指数基金': 'default',
    '宽基指数': 'secondary',
    '私募基金': 'outline',
    '定期存款': 'default',
    '理财产品': 'secondary',
    '现金+': 'outline',
  };
  return variants[category];
};

// Filter options
const FILTER_CHANNEL_OPTIONS = [
  { value: 'all' as const, label: '全部渠道' },
  ...CHANNEL_OPTIONS,
];

const FILTER_CATEGORY_OPTIONS = [
  { value: 'all' as const, label: '全部类别' },
  ...CATEGORY_OPTIONS,
];

const FILTER_STATUS_OPTIONS = [
  { value: 'all' as const, label: '全部状态' },
  ...STATUS_OPTIONS,
];

const FILTER_CURRENCY_OPTIONS = [
  { value: 'all' as const, label: '全部币种' },
  ...CURRENCY_OPTIONS,
];

interface ProductFormProps {
  product?: FinancialProduct;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFinancialProductInput | UpdateFinancialProductInput) => void;
  isPending?: boolean;
}

function ProductForm({ product, open, onClose, onSubmit, isPending }: ProductFormProps) {
  const isEdit = !!product;
  const [formData, setFormData] = useState<CreateFinancialProductInput>({
    name: '',
    channel: '招商银行',
    category: '定期存款',
    currency: 'CNY',
    lock_period_days: 0,
    status: '投资中',
  });

  // Sync formData when product prop changes
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        code: product.code,
        channel: product.channel,
        category: product.category,
        currency: product.currency,
        lock_period_days: product.lock_period_days,
        annual_return_rate: product.annual_return_rate,
        status: product.status,
      });
    } else {
      setFormData({
        name: '',
        channel: '招商银行',
        category: '定期存款',
        currency: 'CNY',
        lock_period_days: 0,
        status: '投资中',
      });
    }
  }, [product, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    if (!isPending) {
      onClose();
    }
  };

  const updateField = <K extends keyof CreateFinancialProductInput>(
    key: K,
    value: CreateFinancialProductInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑产品' : '新增产品'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改理财产品信息' : '添加新的理财产品到产品库'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Product Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                产品名称 <span className="text-expense">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="例如：招商银行朝朝宝"
                required
              />
            </div>

            {/* Product Code */}
            <div className="space-y-2">
              <Label htmlFor="code">产品代码</Label>
              <Input
                id="code"
                value={formData.code || ''}
                onChange={e => updateField('code', e.target.value || undefined)}
                placeholder="银行/基金内部代码"
              />
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <Label htmlFor="channel">
                销售渠道 <span className="text-expense">*</span>
              </Label>
              <Select
                value={formData.channel}
                onValueChange={(value: ProductChannel) => updateField('channel', value)}
              >
                <SelectTrigger id="channel">
                  <SelectValue placeholder="选择销售渠道" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">
                产品类别 <span className="text-expense">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value: ProductCategory) => updateField('category', value)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="选择产品类别" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(option => (
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

            {/* Lock Period */}
            <div className="space-y-2">
              <Label htmlFor="lock_period_days">锁定期 (天)</Label>
              <Input
                id="lock_period_days"
                type="number"
                min="0"
                value={formData.lock_period_days ?? 0}
                onChange={e => updateField('lock_period_days', parseInt(e.target.value) || 0)}
              />
            </div>

            {/* Annual Return Rate */}
            <div className="space-y-2">
              <Label htmlFor="annual_return_rate">年化收益率 (%)</Label>
              <Input
                id="annual_return_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.annual_return_rate ?? ''}
                onChange={e =>
                  updateField('annual_return_rate', e.target.value ? parseFloat(e.target.value) : undefined)
                }
                placeholder="例如：3.50"
              />
            </div>

            {/* Status */}
            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: ProductStatus) => updateField('status', value)}
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

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName: string;
  isPending?: boolean;
}

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  productName,
  isPending,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除产品 <span className="font-semibold">"{productName}"</span> 吗？此操作无法撤销。
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

export function ProductsLibrary() {
  const { data: products, isLoading } = useProducts();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  // Filter state
  const [filterChannel, setFilterChannel] = useState<ProductChannel | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ProductStatus | 'all'>('all');
  const [filterCurrency, setFilterCurrency] = useState<Currency | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [formDialog, setFormDialog] = useState<{
    open: boolean;
    product?: FinancialProduct;
  }>({ open: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    product?: FinancialProduct;
  }>({ open: false });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterChannel !== 'all') count++;
    if (filterCategory !== 'all') count++;
    if (filterStatus !== 'all') count++;
    if (filterCurrency !== 'all') count++;
    return count;
  }, [filterChannel, filterCategory, filterStatus, filterCurrency]);

  // Filtered products with useMemo
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(product => {
      if (filterChannel !== 'all' && product.channel !== filterChannel) return false;
      if (filterCategory !== 'all' && product.category !== filterCategory) return false;
      if (filterStatus !== 'all' && product.status !== filterStatus) return false;
      if (filterCurrency !== 'all' && product.currency !== filterCurrency) return false;
      return true;
    });
  }, [products, filterChannel, filterCategory, filterStatus, filterCurrency]);

  // Reset filters
  const resetFilters = () => {
    setFilterChannel('all');
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterCurrency('all');
  };

  const handleCreate = (data: CreateFinancialProductInput) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setFormDialog({ open: false });
      },
    });
  };

  const handleUpdate = (data: UpdateFinancialProductInput) => {
    if (!formDialog.product) return;
    updateMutation.mutate(
      { id: formDialog.product.id, input: data },
      {
        onSuccess: () => {
          setFormDialog({ open: false });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteDialog.product) return;
    deleteMutation.mutate(deleteDialog.product.id, {
      onSuccess: () => {
        setDeleteDialog({ open: false });
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
      {/* Header with Add button and Filter button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">产品库</h2>
          <span className="text-sm text-muted-foreground">
            ({filteredProducts.length} / {products?.length || 0} 个产品)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? 'border-primary' : ''}
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
            新增产品
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Channel Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">销售渠道</Label>
              <Select
                value={filterChannel}
                onValueChange={(value: ProductChannel | 'all') => setFilterChannel(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_CHANNEL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">产品类别</Label>
              <Select
                value={filterCategory}
                onValueChange={(value: ProductCategory | 'all') => setFilterCategory(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_CATEGORY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">状态</Label>
              <Select
                value={filterStatus}
                onValueChange={(value: ProductStatus | 'all') => setFilterStatus(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">币种</Label>
              <Select
                value={filterCurrency}
                onValueChange={(value: Currency | 'all') => setFilterCurrency(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_CURRENCY_OPTIONS.map(option => (
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

      {/* Products Table */}
      {products && products.length > 0 ? (
        <>
          {filteredProducts.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">代码</TableHead>
                    <TableHead>产品名称</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead>类别</TableHead>
                    <TableHead>币种</TableHead>
                    <TableHead className="text-right">锁定期</TableHead>
                    <TableHead className="text-right">年化收益率</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => (
                    <TableRow key={product.id}>
                      {/* Code - monospace font, first column */}
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {product.code || '-'}
                      </TableCell>
                      {/* Product Name */}
                      <TableCell className="font-medium">{product.name}</TableCell>
                      {/* Channel - Badge */}
                      <TableCell>
                        <Badge variant={getChannelVariant(product.channel)}>
                          {product.channel}
                        </Badge>
                      </TableCell>
                      {/* Category - Badge */}
                      <TableCell>
                        <Badge variant={getCategoryVariant(product.category)}>
                          {product.category}
                        </Badge>
                      </TableCell>
                      {/* Currency - with emoji */}
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <span>{CURRENCY_EMOJI[product.currency]}</span>
                          <span>{product.currency}</span>
                        </span>
                      </TableCell>
                      {/* Lock Period */}
                      <TableCell className="text-right">
                        {product.lock_period_days > 0 ? `${product.lock_period_days} 天` : '-'}
                      </TableCell>
                      {/* Annual Return Rate */}
                      <TableCell className="text-right">
                        {product.annual_return_rate
                          ? `${product.annual_return_rate.toFixed(2)}%`
                          : '-'}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setFormDialog({ open: true, product })}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-expense hover:text-expense hover:bg-expense/10"
                            onClick={() => setDeleteDialog({ open: true, product })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="border rounded-lg p-12 text-center">
              <Filter className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">没有符合筛选条件的产品</p>
              <Button variant="outline" onClick={resetFilters}>
                <X className="w-4 h-4 mr-2" />
                清除筛选条件
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <Banknote className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">还没有添加任何产品</p>
          <Button onClick={() => setFormDialog({ open: true })}>
            <Plus className="w-4 h-4 mr-2" />
            添加第一个产品
          </Button>
        </div>
      )}

      {/* Form Dialog */}
      <ProductForm
        product={formDialog.product}
        open={formDialog.open}
        onClose={() => setFormDialog({ open: false })}
        onSubmit={formDialog.product ? handleUpdate : handleCreate}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false })}
        onConfirm={handleDelete}
        productName={deleteDialog.product?.name || ''}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
