import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TransactionDataTab } from '@/components/dashboard/TransactionDataTab';
import { TransferDataTab } from '@/components/dashboard/TransferDataTab';
import { AssetDataTab } from '@/components/dashboard/AssetDataTab';
import type { StoredYearData } from '@/hooks/useTransactions';
import type { DataQualityMetrics, TransactionValidation } from '@/types/data';
import {
  Cloud,
  FileText,
  ArrowRightLeft,
  Package,
} from 'lucide-react';

interface DataManagementProps {
  storedYearsData: StoredYearData[];
  isLoading: boolean;
  onDeleteYear: (year: number) => void;
  onClearAll: () => void;
  onExport: () => void;
  onGoToImport: () => void;
  onViewQuality: (year: number) => void;
  qualityData?: { year: number; metrics: DataQualityMetrics; validations: TransactionValidation[] } | null;
}

export function DataManagement({
  storedYearsData,
  isLoading,
  onDeleteYear,
  onClearAll,
  onExport,
  onGoToImport,
  onViewQuality,
  qualityData,
}: DataManagementProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Cloud className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">云端数据管理</h2>
            <p className="text-muted-foreground text-sm">
              查看和管理存储在云端的财务数据
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions" className="gap-1.5">
            <FileText className="h-4 w-4" />
            收支流水
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-1.5">
            <ArrowRightLeft className="h-4 w-4" />
            转账数据
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <Package className="h-4 w-4" />
            资产数据
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <TransactionDataTab
            storedYearsData={storedYearsData}
            isLoading={isLoading}
            onDeleteYear={onDeleteYear}
            onClearAll={onClearAll}
            onExport={onExport}
            onGoToImport={onGoToImport}
            onViewQuality={onViewQuality}
            qualityData={qualityData}
          />
        </TabsContent>

        <TabsContent value="transfers">
          <TransferDataTab />
        </TabsContent>

        <TabsContent value="assets">
          <AssetDataTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
