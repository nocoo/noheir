import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseTransactions } from '@/hooks/useSupabaseTransactions';
import { useTransactions } from '@/hooks/useTransactions';
import { ParsedTransaction } from '@/types/data';
import { parseCSVFile } from '@/lib/csvParser';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  LogIn,
  Calendar,
  Database,
  ArrowRight,
} from 'lucide-react';
import { ImportUI, type ImportStep, type StepInfo } from '@/components/dashboard/shared';

interface DataImportProps {
  onUploadComplete?: () => void;
  onNavigateToManage?: () => void;
}

export function DataImport({ onUploadComplete, onNavigateToManage }: DataImportProps) {
  const { user, signInWithGoogle } = useAuth();
  const { loadStoredData } = useTransactions();
  const { checkExistingData, uploadTransactions, deleteYearData } = useSupabaseTransactions();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import process state
  const [step, setStep] = useState<ImportStep>('idle');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [csvYear, setCsvYear] = useState<number | null>(null);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep('idle');
    setParsedTransactions([]);
    setCsvYear(null);
    setExistingCount(null);
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
      // Parse CSV
      const result = await parseCSVFile(file);

      if (result.errors.length > 0) {
        const error = result.errors[0];

        // Special error message for header validation
        if (error.row === 1 && error.message.includes('表头')) {
          setErrorMessage(`文件格式错误：您上传的可能是"转账数据"文件，请上传"收支流水"文件。`);
        } else {
          setErrorMessage(`CSV 解析失败: ${error.message}`);
        }

        setStep('error');
        return;
      }

      if (result.transactions.length === 0) {
        setErrorMessage('CSV 文件中没有有效的交易记录');
        setStep('error');
        return;
      }

      // Validate year consistency
      const years = new Set(result.transactions.map(t => t.year));
      if (years.size > 1) {
        setErrorMessage(`CSV 文件中包含多个年份的数据: ${Array.from(years).sort().join(', ')}。请确保所有数据属于同一年份。`);
        setStep('error');
        return;
      }

      const year = result.transactions[0].year;
      setCsvYear(year);
      setParsedTransactions(result.transactions);
      setStep('validating');

      // Check for existing data in Supabase
      const count = await checkExistingData(year);
      setExistingCount(count);
      setStep('confirming');

    } catch (error) {
      console.error('File processing error:', error);
      setErrorMessage(error instanceof Error ? error.message : '文件处理失败');
      setStep('error');
    }
  };

  // Get step info for UI display
  const getStepInfo = (): StepInfo => {
    switch (step) {
      case 'idle':
        return {
          icon: <Upload className="h-8 w-8 text-muted-foreground" />,
          title: '拖拽或点击上传收支流水 CSV 文件',
          description: '支持 CSV 格式',
        };
      case 'parsing':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: '正在解析 CSV 文件...',
          description: fileName || '',
        };
      case 'validating':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: '正在验证数据...',
          description: `${parsedTransactions.length} 条记录`,
        };
      case 'confirming':
        return {
          icon: <CheckCircle2 className="h-8 w-8 text-green-600" />,
          title: '解析成功',
          description: `${parsedTransactions.length} 条记录`,
        };
      case 'uploading':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: '正在上传到云端...',
          description: `${parsedTransactions.length} 条记录`,
        };
      case 'done':
        return {
          icon: <CheckCircle2 className="h-8 w-8 text-green-600" />,
          title: '导入成功！',
          description: `已成功导入 ${parsedTransactions.length} 条收支记录`,
        };
      case 'error':
        return {
          icon: <AlertTriangle className="h-8 w-8 text-destructive" />,
          title: '导入失败',
          description: errorMessage || '未知错误',
        };
      default:
        return {
          icon: <Upload className="h-8 w-8 text-muted-foreground" />,
          title: '准备中',
          description: '',
        };
    }
  };

  // Confirm and upload
  const handleConfirmUpload = async () => {
    if (!csvYear || parsedTransactions.length === 0) return;

    setStep('uploading');
    setUploadProgress(0);

    try {
      // Delete existing data if any
      if (existingCount && existingCount > 0) {
        setUploadProgress(10);
        await deleteYearData(csvYear);
        setUploadProgress(30);
      }

      // Upload new data
      const result = await uploadTransactions(parsedTransactions, csvYear);

      if (result.success) {
        setUploadProgress(100);
        setStep('done');
        toast.success(`成功上传 ${result.uploaded ?? parsedTransactions.length} 条交易记录`);

        // Reload data in background without blocking UI
        loadStoredData().catch(console.error);

        // Call completion callback
        if (onUploadComplete) {
          onUploadComplete();
        }

        // Auto-navigate to management page after short delay
        if (onNavigateToManage) {
          setTimeout(() => {
            onNavigateToManage();
          }, 1500);
        }
      } else {
        throw new Error(result.error || '上传失败');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage(error instanceof Error ? error.message : '上传失败');
      setStep('error');
      toast.error(errorMessage || '上传失败');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (step !== 'idle') return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file).catch(console.error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (step === 'idle') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && step === 'idle') {
      handleFile(file).catch(console.error);
    }
  };

  const handleRetry = () => {
    resetState();
  };

  const stepInfo = getStepInfo();

  // Login required UI
  if (!user) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="p-4 bg-muted rounded-full">
              <LogIn className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-medium">请先登录</p>
              <p className="text-sm text-muted-foreground">
                登录后即可将数据安全地存储到云端，随时随地访问
              </p>
            </div>
            <Button onClick={signInWithGoogle} className="gap-2">
              <LogIn className="h-4 w-4" />
              使用 Google 账号登录
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ImportUI
        step={step}
        stepInfo={stepInfo}
        isDragging={isDragging}
        fileName={fileName}
        uploadProgress={uploadProgress}
        errorMessage={errorMessage}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onFileInputClick={() => fileInputRef.current?.click()}
        onFileInputChange={handleInputChange}
        onRetry={handleRetry}
        fileInputRef={fileInputRef}
        showCard={false}
        confirmationContent={
          <div className="space-y-4">
            <div className="flex items-center gap-4 py-3 px-4 bg-muted rounded-lg">
              <Badge variant="outline" className="text-lg px-3 py-1">
                <Calendar className="h-3 w-3 mr-1" />
                {csvYear}
              </Badge>
              <div className="text-sm">
                <span className="font-medium">{parsedTransactions.length}</span> 条记录
              </div>
            </div>
            {existingCount && existingCount > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  该年份已存在 <span className="font-medium">{existingCount}</span> 条数据，
                  上传新数据将覆盖旧数据。
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  该年份暂无数据，将创建新记录。
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleRetry}>
                取消
              </Button>
              <Button onClick={handleConfirmUpload} className="gap-2">
                确认上传
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
        extraContent={
          <div className="space-y-3">
            <Alert>
              <Database className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <span className="font-medium">云端存储：</span>
                数据将安全地存储在您的个人账户中，支持多设备同步访问。
              </AlertDescription>
            </Alert>

            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <span className="font-medium">年份要求：</span>
                CSV 文件中的所有数据必须属于同一年份。
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <span className="font-medium">覆盖规则：</span>
                如果该年份已存在数据，上传新数据将覆盖旧数据。
              </AlertDescription>
            </Alert>
          </div>
        }
        errorActions={
          <>
            <Button variant="outline" onClick={handleRetry}>
              重试
            </Button>
          </>
        }
        doneActions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRetry}>
              继续导入
            </Button>
            <Button onClick={() => {
              if (onNavigateToManage) {
                onNavigateToManage();
              } else {
                window.location.hash = '#manage';
              }
            }}>
              前往数据管理
            </Button>
          </div>
        }
      />
    </Card>
  );
}
