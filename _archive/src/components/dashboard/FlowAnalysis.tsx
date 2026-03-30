import { Transaction } from '@/types/transaction';
import { UnifiedYearSelector } from '@/components/dashboard/UnifiedYearSelector';
import { SankeyChart } from '@/components/dashboard/SankeyChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useFlowAnalysisViewModel } from '@/viewmodels/dashboard/useFlowAnalysisViewModel';

interface FlowAnalysisProps {
  transactions: Transaction[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

export function FlowAnalysis({ transactions, selectedYear, availableYears, onYearChange }: FlowAnalysisProps) {
  const {
    tabs,
    title,
    flowTransactions,
    selectedYear: vmSelectedYear,
    availableYears: vmAvailableYears,
    onYearChange: vmOnYearChange,
  } = useFlowAnalysisViewModel({
    transactions,
    selectedYear,
    availableYears,
    onYearChange,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title.title}</h1>
          <p className="text-muted-foreground">{title.description}</p>
        </div>
        <UnifiedYearSelector mode="single" selectedYear={vmSelectedYear} availableYears={vmAvailableYears} onChange={vmOnYearChange} />
      </div>

      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value={tabs[0].value} className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {tabs[0].label}
          </TabsTrigger>
          <TabsTrigger value={tabs[1].value} className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            {tabs[1].label}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabs[0].value} className="mt-6">
          <SankeyChart transactions={flowTransactions} type="income" />
        </TabsContent>

        <TabsContent value={tabs[1].value} className="mt-6">
          <SankeyChart transactions={flowTransactions} type="expense" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
