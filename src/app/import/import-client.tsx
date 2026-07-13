"use client";

import { FileUp, ArrowRightLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionImport } from "./transaction-import";
import { TransferImport } from "./transfer-import";

export function ImportClient() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileUp className="text-primary size-6" />
          数据导入
        </h1>
        <p className="text-muted-foreground text-sm">从 CSV 文件导入收支流水和转账数据</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transaction" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transaction" className="gap-2">
            <FileUp className="size-4" />
            收支流水
          </TabsTrigger>
          <TabsTrigger value="transfer" className="gap-2">
            <ArrowRightLeft className="size-4" />
            转账数据
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transaction" className="mt-4">
          <TransactionImport />
        </TabsContent>

        <TabsContent value="transfer" className="mt-4">
          <TransferImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
