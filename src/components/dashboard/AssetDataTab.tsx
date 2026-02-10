import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProductExportImport } from '@/viewmodels/dataManagement/useProductExportImport';
import { useUnitExportImport } from '@/viewmodels/dataManagement/useUnitExportImport';
import { assetQueryKeys } from '@/hooks/useAssets';
import { fetchProducts, fetchUnits } from '@/services/assetService';
import { formatCurrencyFull } from '@/lib/chart-config';
import {
  Package,
  Boxes,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cloud,
  Wallet,
} from 'lucide-react';

interface AssetOverview {
  productCount: number;
  unitCount: number;
  totalAmount: number;
}

export function AssetDataTab() {
  const [overview, setOverview] = useState<AssetOverview>({ productCount: 0, unitCount: 0, totalAmount: 0 });
  const [overviewLoading, setOverviewLoading] = useState(true);

  const product = useProductExportImport();
  const unit = useUnitExportImport();
  const queryClient = useQueryClient();

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [products, units] = await Promise.all([
        fetchProducts(),
        fetchUnits(false),
      ]);
      setOverview({
        productCount: products.length,
        unitCount: units.length,
        totalAmount: units.reduce((sum, u) => sum + u.amount, 0),
      });
    } catch {
      // Silently fail — overview is informational
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Reload overview and invalidate React Query caches after successful import
  const handleProductImportClose = () => {
    if (product.importState.step === 'done') {
      loadOverview();
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allProducts });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success(`成功导入 ${product.importState.result.products_created} 个产品`);
    }
    product.handleImportClose();
  };

  const handleUnitImportClose = () => {
    if (unit.importState.step === 'done') {
      loadOverview();
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success(`成功导入 ${unit.importState.result.units_created} 个资金单元`);
    }
    unit.handleImportClose();
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">理财产品</p>
                <p className="text-2xl font-bold mt-1">
                  {overviewLoading ? '...' : overview.productCount}
                </p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">资金单元</p>
                <p className="text-2xl font-bold mt-1">
                  {overviewLoading ? '...' : overview.unitCount}
                </p>
              </div>
              <Boxes className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">资金总额</p>
                <p className="text-2xl font-bold mt-1">
                  {overviewLoading ? '...' : formatCurrencyFull(overview.totalAmount)}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            产品数据
          </CardTitle>
          <CardDescription>
            导出或导入理财产品数据（JSON 格式）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={product.handleExport} variant="outline" className="gap-2" disabled={product.exporting}>
              {product.exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              导出产品数据
            </Button>
            <Button onClick={product.triggerFileSelect} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              导入产品数据
            </Button>
            <input
              ref={product.fileInputRef}
              type="file"
              accept=".json"
              onChange={product.handleFileSelect}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Unit Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            资金单元数据
          </CardTitle>
          <CardDescription>
            导出或导入资金单元数据（JSON 格式）。导入时会自动匹配已有产品。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={unit.handleExport} variant="outline" className="gap-2" disabled={unit.exporting}>
              {unit.exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              导出资金单元
            </Button>
            <Button onClick={unit.triggerFileSelect} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              导入资金单元
            </Button>
            <input
              ref={unit.fileInputRef}
              type="file"
              accept=".json"
              onChange={unit.handleFileSelect}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Cloud className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <span className="font-medium">产品与资金单元：</span>
                产品定义理财产品的基本信息，资金单元记录具体的资金分配。导入时建议先导入产品，再导入资金单元。
              </p>
              <p>
                <span className="font-medium">数据格式：</span>
                导出为独立的 JSON 文件，产品和资金单元分别导出。导入时会追加到现有数据，不会覆盖。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Import Dialog */}
      <AlertDialog open={product.importDialogOpen} onOpenChange={(open) => { if (!open) handleProductImportClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {product.importState.step === 'error' ? '导入失败' :
               product.importState.step === 'done' ? '导入完成' :
               product.importState.step === 'importing' ? '正在导入...' :
               '导入产品数据'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {product.importState.step === 'preview' && (
                  <>
                    <p>即将导入以下产品数据（追加到现有数据）：</p>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">产品数</p>
                      <p className="text-xl font-bold">{product.importState.data.products.length}</p>
                    </div>
                    {product.importState.warnings.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          警告 ({product.importState.warnings.length})
                        </p>
                        <ul className="mt-1 text-xs text-amber-600 space-y-0.5">
                          {product.importState.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {product.importState.step === 'importing' && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}

                {product.importState.step === 'done' && (
                  <>
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>导入成功</span>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">创建产品</p>
                      <p className="text-xl font-bold text-green-700">{product.importState.result.products_created}</p>
                    </div>
                    {product.importState.result.warnings.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-medium text-amber-700">导入警告：</p>
                        <ul className="mt-1 text-xs text-amber-600 space-y-0.5">
                          {product.importState.result.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {product.importState.result.errors.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-700">导入错误：</p>
                        <ul className="mt-1 text-xs text-red-600 space-y-0.5">
                          {product.importState.result.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {product.importState.step === 'error' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      错误
                    </p>
                    <p className="mt-1 text-xs text-red-600 whitespace-pre-wrap">{product.importState.message}</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {product.importState.step === 'preview' && (
              <>
                <AlertDialogCancel onClick={handleProductImportClose}>取消</AlertDialogCancel>
                <AlertDialogAction onClick={product.handleImportConfirm}>
                  确认导入
                </AlertDialogAction>
              </>
            )}
            {(product.importState.step === 'done' || product.importState.step === 'error') && (
              <AlertDialogAction onClick={handleProductImportClose}>
                关闭
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unit Import Dialog */}
      <AlertDialog open={unit.importDialogOpen} onOpenChange={(open) => { if (!open) handleUnitImportClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              {unit.importState.step === 'error' ? '导入失败' :
               unit.importState.step === 'done' ? '导入完成' :
               unit.importState.step === 'importing' ? '正在导入...' :
               '导入资金单元'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {unit.importState.step === 'preview' && (
                  <>
                    <p>即将导入以下资金单元数据（追加到现有数据）：</p>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">资金单元数</p>
                      <p className="text-xl font-bold">{unit.importState.data.units.length}</p>
                    </div>
                    {unit.importState.warnings.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          警告 ({unit.importState.warnings.length})
                        </p>
                        <ul className="mt-1 text-xs text-amber-600 space-y-0.5">
                          {unit.importState.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {unit.importState.step === 'importing' && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}

                {unit.importState.step === 'done' && (
                  <>
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>导入成功</span>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">创建资金单元</p>
                      <p className="text-xl font-bold text-green-700">{unit.importState.result.units_created}</p>
                    </div>
                    {unit.importState.result.warnings.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-medium text-amber-700">导入警告：</p>
                        <ul className="mt-1 text-xs text-amber-600 space-y-0.5">
                          {unit.importState.result.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {unit.importState.result.errors.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-700">导入错误：</p>
                        <ul className="mt-1 text-xs text-red-600 space-y-0.5">
                          {unit.importState.result.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {unit.importState.step === 'error' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      错误
                    </p>
                    <p className="mt-1 text-xs text-red-600 whitespace-pre-wrap">{unit.importState.message}</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {unit.importState.step === 'preview' && (
              <>
                <AlertDialogCancel onClick={handleUnitImportClose}>取消</AlertDialogCancel>
                <AlertDialogAction onClick={unit.handleImportConfirm}>
                  确认导入
                </AlertDialogAction>
              </>
            )}
            {(unit.importState.step === 'done' || unit.importState.step === 'error') && (
              <AlertDialogAction onClick={handleUnitImportClose}>
                关闭
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
