import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseTransactions } from '@/hooks/useSupabaseTransactions';
import { useTransactions } from '@/hooks/useTransactions';
import { ParsedTransaction } from '@/types/data';
import { parseCSVFile } from '@/lib/csvParser';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  LogIn,
  Calendar,
  Database,
  ArrowRight,
} from 'lucide-react';

interface DataImportProps {
  onUploadComplete?: () => void;
}

type ImportStep = 'idle' | 'parsing' | 'validating' | 'checking_db' | 'confirming' | 'uploading' | 'done' | 'error';

export function DataImport({ onUploadComplete }: DataImportProps) {
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
        setErrorMessage(`CSV 解析失败: ${result.errors[0].message}`);
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

        // Reload data from Supabase
        await loadStoredData();
        onUploadComplete?.();
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

  // Login required UI
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            数据导入
          </CardTitle>
          <CardDescription>
            上传 CSV 文件导入交易数据到云端
          </CardDescription>
        </CardHeader>
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          数据导入
        </CardTitle>
        <CardDescription>
          上传 CSV 文件导入交易数据到云端
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
            ${step !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={() => step === 'idle' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
            disabled={step !== 'idle'}
          />

          {step === 'parsing' || step === 'validating' || step === 'checking_db' || step === 'uploading' ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-medium">
                {step === 'parsing' && '正在解析 CSV 文件...'}
                {step === 'validating' && '正在验证数据...'}
                {step === 'checking_db' && '正在检查云端数据...'}
                {step === 'uploading' && '正在上传到云端...'}
              </p>
              {step === 'uploading' && (
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                </div>
              )}
            </div>
          ) : step === 'done' ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-income" />
              <p className="font-medium">导入成功！</p>
              <Button variant="outline" size="sm" onClick={handleRetry} className="mt-2">
                导入更多数据
              </Button>
            </div>
          ) : step === 'error' ? (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="h-10 w-10 text-expense" />
              <p className="font-medium">导入失败</p>
              {errorMessage && (
                <p className="text-sm text-muted-foreground text-center max-w-md">{errorMessage}</p>
              )}
              <Button variant="outline" size="sm" onClick={handleRetry} className="mt-2">
                重试
              </Button>
            </div>
          ) : fileName ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-primary" />
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

        {/* Info Section */}
        <div className="mt-4 space-y-3">
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

        {/* Confirmation Dialog */}
        <AlertDialog open={step === 'confirming'} onOpenChange={(open) => !open && handleRetry()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认上传数据？</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>即将上传以下数据到云端：</p>
                  <div className="flex items-center gap-4 py-2 px-3 bg-muted rounded-lg">
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
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleRetry}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmUpload} className="gap-2">
                确认上传
                <ArrowRight className="h-4 w-4" />
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
