import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useTransfers } from '@/hooks/useTransfers';
import { ParsedTransfer } from '@/types/data';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  ArrowRight,
  XCircle,
} from 'lucide-react';

interface TransferImportPageProps {
  onNavigateToManage?: () => void;
}

type ImportStep = 'idle' | 'selecting' | 'parsing' | 'uploading' | 'done' | 'error';

export function TransferImportPage({ onNavigateToManage }: TransferImportPageProps = {}) {
  const { user } = useAuth();
  const { parseTransferCSV, uploadTransfers, loadTransfers } = useTransfers();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import process state
  const [step, setStep] = useState<ImportStep>('idle');
  const [parsedTransfers, setParsedTransfers] = useState<ParsedTransfer[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep('idle');
    setParsedTransfers([]);
    setSelectedYear(null);
    setUploadProgress(0);
    setErrorMessage(null);
    setFileName(null);
  }, []);

  // Handle file selection
  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('请上传 CSV 格式的文件');
      setFileName(null);
      return;
    }

    if (!user) {
      toast.error('请先登录');
      return;
    }

    setFileName(file.name);
    await processFile(file);
  };

  // Process the CSV file
  const processFile = async (file: File) => {
    setStep('parsing');
    setErrorMessage(null);

    try {
      // Read file
      const text = await file.text();

      // Parse transfers
      const transfers = parseTransferCSV(text);

      if (transfers.length === 0) {
        setErrorMessage('CSV 文件中没有有效的转账数据');
        setStep('error');
        return;
      }

      setParsedTransfers(transfers);

      // Extract year from first transfer
      const year = transfers[0]?.year;
      if (year) {
        setSelectedYear(year);
        setStep('selecting');
      } else {
        setErrorMessage('无法从数据中提取年份信息');
        setStep('error');
      }
    } catch (error: any) {
      console.error('Transfer import error:', error);
      setErrorMessage(error?.message || '解析失败，请重试');
      setStep('error');
    }
  };

  // Confirm and upload
  const handleConfirmUpload = async () => {
    if (!selectedYear) return;

    setStep('uploading');

    try {
      setUploadProgress(0);
      await uploadTransfers(parsedTransfers, selectedYear);
      setUploadProgress(100);

      toast.success(`成功导入 ${parsedTransfers.length} 条转账记录`);
      setStep('done');

      // Reload transfers data
      await loadTransfers();
    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(error?.message || '导入失败，请重试');
      setStep('error');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  // Get step info
  const getStepContent = () => {
    switch (step) {
      case 'idle':
        return (
          <div className="space-y-6">
            <div
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInputChange}
              />

              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                拖拽或点击上传转账 CSV 文件
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                支持 CSV 格式，文件名建议包含年份，如: 2025_zhuanzhang.csv
              </p>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                选择文件
              </Button>
            </div>

            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>CSV 格式要求:</strong> 日期,收支大类,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'parsing':
        return (
          <div className="space-y-4 text-center py-8">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <h3 className="text-lg font-semibold">正在解析 CSV 文件...</h3>
            <p className="text-sm text-muted-foreground">{fileName}</p>
          </div>
        );

      case 'selecting':
        return (
          <div className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>解析成功!</strong> 共找到 <span className="font-semibold">{parsedTransfers.length}</span> 条转账记录
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>确认导入信息</CardTitle>
                <CardDescription>
                  请确认以下信息后开始上传
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">目标年份</p>
                    <p className="text-2xl font-bold">{selectedYear}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">记录数量</p>
                    <p className="text-2xl font-bold">{parsedTransfers.length}</p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    文件信息
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    文件名: {fileName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    注意: 导入后该年份的旧转账数据将被替换
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleConfirmUpload} className="flex-1">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    确认并上传
                  </Button>
                  <Button variant="outline" onClick={resetState}>
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'uploading':
        return (
          <div className="space-y-4 text-center py-8">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <h3 className="text-lg font-semibold">正在上传到云端...</h3>
            <p className="text-sm text-muted-foreground">{parsedTransfers.length} 条记录</p>
            <div className="max-w-md mx-auto space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-xs text-muted-foreground">
                {uploadProgress}% 完成
              </p>
            </div>
          </div>
        );

      case 'done':
        return (
          <div className="space-y-6 text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
            <h3 className="text-2xl font-bold text-green-600">导入成功！</h3>
            <p className="text-muted-foreground">
              已成功导入 {parsedTransfers.length} 条转账记录到 {selectedYear} 年
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={resetState} variant="outline">
                继续导入
              </Button>
              <Button onClick={() => {
                if (onNavigateToManage) {
                  onNavigateToManage();
                } else {
                  // Fallback to hash navigation
                  window.location.hash = '#manage';
                }
              }}>
                前往数据管理
              </Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-6 text-center py-8">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h3 className="text-2xl font-bold text-destructive">导入失败</h3>
            <p className="text-muted-foreground">
              {errorMessage || '未知错误，请重试'}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                重新上传
              </Button>
              <Button onClick={resetState}>
                取消
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">导入转账数据</h1>
        <p className="text-muted-foreground">上传账户间转账数据文件</p>
      </div>

      <Card>
        <CardContent className="p-6">
          {getStepContent()}
        </CardContent>
      </Card>
    </div>
  );
}
