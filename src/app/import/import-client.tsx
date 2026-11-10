import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nocoo/basalt/components/tabs";
import { ArrowRightLeft, FileUp } from "lucide-react";
import { TransactionImport } from "./transaction-import";
import { TransferImport } from "./transfer-import";

export function ImportClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FileUp className="text-basalt-primary size-6" />
            数据导入
          </span>
        }
        description="从 CSV 文件导入收支流水和转账数据"
      />

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
