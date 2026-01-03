import { Transaction } from '@/types/transaction';
import { UnifiedYearSelector } from '@/components/dashboard/UnifiedYearSelector';
import { SankeyChart } from '@/components/dashboard/SankeyChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface FlowAnalysisProps {
  transactions: Transaction[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

export function FlowAnalysis({ transactions, selectedYear, availableYears, onYearChange }: FlowAnalysisProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">流向分析</h1>
          <p className="text-muted-foreground">可视化资金从来源到分类的流向分布</p>
        </div>
        <UnifiedYearSelector mode="single" selectedYear={selectedYear} availableYears={availableYears} onChange={onYearChange} />
      </div>

      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="income" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            收入流向
          </TabsTrigger>
          <TabsTrigger value="expense" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            支出流向
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-6">
          <SankeyChart transactions={transactions} type="income" />
        </TabsContent>

        <TabsContent value="expense" className="mt-6">
          <SankeyChart transactions={transactions} type="expense" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
