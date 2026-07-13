"use client";

import { ArrowRight, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrencyFull } from "@/lib/chart-config";

interface FlowNode {
  source: string;
  target: string;
  value: number;
}

interface FlowAnalysisClientProps {
  incomeFlows: FlowNode[];
  expenseFlows: FlowNode[];
}

const INCOME_COLORS = [
  "bg-emerald-500",
  "bg-emerald-400",
  "bg-emerald-300",
  "bg-teal-500",
  "bg-teal-400",
];

const EXPENSE_COLORS = ["bg-rose-500", "bg-rose-400", "bg-rose-300", "bg-red-500", "bg-red-400"];

function FlowList({ flows, colors }: { flows: FlowNode[]; colors: string[] }) {
  const maxValue = flows[0]?.value ?? 1;

  if (flows.length === 0) {
    return <div className="text-muted-foreground py-8 text-center text-sm">暂无数据</div>;
  }

  return (
    <div className="space-y-2">
      {flows.map((flow, index) => {
        const widthPct = Math.max((flow.value / maxValue) * 100, 5);
        const colorClass = colors[index % colors.length] ?? colors[0] ?? "bg-gray-400";

        return (
          <div key={`${flow.source}-${flow.target}`} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {flow.source}
                </Badge>
                <ArrowRight className="text-muted-foreground size-3" />
                <Badge variant="secondary" className="text-xs">
                  {flow.target}
                </Badge>
              </div>
              <span className="font-medium">{formatCurrencyFull(flow.value)}</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${colorClass}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FlowAnalysisClient({ incomeFlows, expenseFlows }: FlowAnalysisClientProps) {
  const [tab, setTab] = useState<string>("income");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ArrowRightLeft className="text-primary size-6" />
            流向分析
          </h1>
          <p className="text-muted-foreground text-sm">可视化资金从来源到分类的流向分布</p>
        </div>
      </div>

      {/* Flow Chart */}
      <Card>
        <CardHeader>
          <CardTitle>资金流向</CardTitle>
          <CardDescription>展示账户到分类、分类到子分类的资金流向</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="income">收入流向 ({incomeFlows.length})</TabsTrigger>
              <TabsTrigger value="expense">支出流向 ({expenseFlows.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="income" className="pt-4">
              <FlowList flows={incomeFlows} colors={INCOME_COLORS} />
            </TabsContent>
            <TabsContent value="expense" className="pt-4">
              <FlowList flows={expenseFlows} colors={EXPENSE_COLORS} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
