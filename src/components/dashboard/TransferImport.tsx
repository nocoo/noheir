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
  X,
} from 'lucide-react';

interface TransferImportProps {
  year: number;
  onUploadComplete?: () => void;
  onClose?: () => void;
}

type ImportStep = 'idle' | 'parsing' | 'uploading' | 'done' | 'error';

export function TransferImport({ year, onUploadComplete, onClose }: TransferImportProps) {
  const { user } = useAuth();
  const { parseTransferCSV, uploadTransfers } = useTransfers();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import process state
  const [step, setStep] = useState<ImportStep>('idle');
  const [parsedTransfers, setParsedTransfers] = useState<ParsedTransfer[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep('idle');
    setParsedTransfers([]);
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

      // Check year matches
      const firstTransferYear = transfers[0]?.year;
      if (firstTransferYear !== year) {
        setErrorMessage(`CSV 文件中的年份 (${firstTransferYear}) 与选择的年份 (${year}) 不匹配`);
        setStep('error');
        return;
      }

      setParsedTransfers(transfers);
      setStep('uploading');

      // Upload to Supabase
      setUploadProgress(0);
      await uploadTransfers(transfers, year);
      setUploadProgress(100);

      toast.success(`成功导入 ${transfers.length} 条转账记录`);
      setStep('done');

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Transfer import error:', error);
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
  const getStepInfo = () => {
    switch (step) {
      case 'idle':
        return {
          icon: <Upload className="h-8 w-8 text-muted-foreground" />,
          title: '拖拽或点击上传转账 CSV 文件',
          description: `年份: ${year}`,
        };
      case 'parsing':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: '正在解析 CSV 文件...',
          description: fileName || '',
        };
      case 'uploading':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: '正在上传到云端...',
          description: `${parsedTransfers.length} 条记录`,
        };
      case 'done':
        return {
          icon: <CheckCircle2 className="h-8 w-8 text-green-600" />,
          title: '导入成功！',
          description: `已成功导入 ${parsedTransfers.length} 条转账记录`,
        };
      case 'error':
        return {
          icon: <AlertTriangle className="h-8 w-8 text-destructive" />,
          title: '导入失败',
          description: errorMessage || '未知错误',
        };
      default:
        return null;
    }
  };

  const stepInfo = getStepInfo();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              导入转账数据
            </CardTitle>
            <CardDescription>
              上传 {year} 年的转账 CSV 文件
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          } ${step !== 'idle' && step !== 'error' ? 'pointer-events-none opacity-50' : ''}`}
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

          {stepInfo && (
            <div className="space-y-4">
              <div className="flex justify-center">{stepInfo.icon}</div>
              <div>
                <h3 className="text-lg font-semibold">{stepInfo.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{stepInfo.description}</p>
              </div>

              {step === 'idle' && (
                <Button variant="outline" className="mt-4">
                  <FileText className="h-4 w-4 mr-2" />
                  选择文件
                </Button>
              )}

              {step === 'uploading' && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-xs text-muted-foreground">
                    {uploadProgress}% 完成
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* File format info */}
        {step === 'idle' && (
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>CSV 格式要求:</strong> 日期,收支大类,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
            </AlertDescription>
          </Alert>
        )}

        {/* Error message */}
        {step === 'error' && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              重新上传
            </Button>
            <Button variant="ghost" onClick={resetState}>
              取消
            </Button>
          </div>
        )}

        {/* Done state */}
        {step === 'done' && (
          <div className="flex gap-3">
            <Button onClick={onClose}>
              完成
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
