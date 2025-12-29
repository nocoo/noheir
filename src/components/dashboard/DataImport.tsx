import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { toast } from '@/hooks/use-toast';

interface DataImportProps {
  onImport: (transactions: Transaction[]) => void;
}

export function DataImport({ onImport }: DataImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (content: string): Transaction[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const transactions: Transaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 5) continue;

      const dateStr = values[0];
      const dateParts = dateStr.split(/[-/]/);
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const amount = parseFloat(values[3]) || 0;

      transactions.push({
        id: `imported-${Date.now()}-${i}`,
        date: dateStr,
        year,
        month,
        primaryCategory: values[1] || '其他',
        secondaryCategory: values[2] || '未分类',
        amount: Math.abs(amount),
        account: values[4] || '未知账户',
        type: amount >= 0 ? 'income' : 'expense',
      });
    }

    return transactions;
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: '文件格式错误',
        description: '请上传 CSV 格式的文件',
        variant: 'destructive',
      });
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const transactions = parseCSV(content);
      
      if (transactions.length === 0) {
        toast({
          title: '解析失败',
          description: '未能从文件中解析出有效数据',
          variant: 'destructive',
        });
        return;
      }

      onImport(transactions);
      toast({
        title: '导入成功',
        description: `成功导入 ${transactions.length} 条交易记录`,
      });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          数据导入
        </CardTitle>
        <CardDescription>
          上传 CSV 文件导入交易数据，格式：日期,一级分类,二级分类,金额,账户
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />
          
          {fileName ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="font-medium">{fileName}</p>
              <p className="text-sm text-muted-foreground">点击重新选择文件</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">拖拽文件到此处或点击上传</p>
              <p className="text-sm text-muted-foreground">支持 CSV 格式</p>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-accent/50 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-accent-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-accent-foreground">CSV 格式说明</p>
              <p className="text-muted-foreground mt-1">
                第一行为表头，之后每行一条记录。列顺序：日期(YYYY-MM-DD), 一级分类, 二级分类, 金额(正数为收入,负数为支出), 账户
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
