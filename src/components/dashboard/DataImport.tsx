import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

interface DataImportProps {
  onLoadFile: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export function DataImport({ onLoadFile, isLoading = false }: DataImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setFileName(null);
      throw new Error('请上传 CSV 格式的文件');
    }

    setFileName(file.name);
    await onLoadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file).catch(err => {
        console.error('Drop error:', err);
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLoading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !isLoading) {
      handleFile(file).catch(err => {
        console.error('File input error:', err);
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          数据导入
        </CardTitle>
        <CardDescription>
          上传 CSV 文件导入交易数据（支持真实数据格式）
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
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
            disabled={isLoading}
          />

          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-medium">正在处理文件...</p>
              <p className="text-sm text-muted-foreground">正在解析和校验数据</p>
            </div>
          ) : fileName ? (
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

        <div className="mt-4 space-y-3">
          <div className="p-4 bg-accent/50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-accent-foreground mt-0.5" />
              <div className="text-sm flex-1">
                <p className="font-medium text-accent-foreground">CSV 格式说明</p>
                <p className="text-muted-foreground mt-1">
                  期望格式：日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm flex-1">
                <p className="font-medium text-muted-foreground">示例数据</p>
                <code className="text-xs block mt-1 p-2 bg-background rounded">
                  2023-01-01,日常支出,电费,0.00,20.00,人民币,招商银行-生活账户,,
                </code>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
