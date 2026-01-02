import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  X,
  LucideIcon,
} from 'lucide-react';

export type ImportStep = 'idle' | 'parsing' | 'validating' | 'confirming' | 'uploading' | 'done' | 'error';

export interface StepInfo {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface ImportUIProps {
  // State
  step: ImportStep;
  stepInfo: StepInfo;
  isDragging: boolean;
  fileName: string | null;
  uploadProgress: number;
  errorMessage: string | null;

  // Actions
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInputClick: () => void;
  onFileInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRetry?: () => void;
  onClose?: () => void;

  // File input
  fileInputRef: React.RefObject<HTMLInputElement>;
  accept?: string;

  // Custom content
  extraContent?: ReactNode;

  // Config
  showFileFormatInfo?: boolean;
  fileFormatInfo?: {
    icon: LucideIcon;
    content: ReactNode;
  };
  confirmationContent?: ReactNode;
  doneActions?: ReactNode;
  errorActions?: ReactNode;

  // Card wrapper
  showCard?: boolean;
}

export function ImportUI({
  step,
  stepInfo,
  isDragging,
  fileName,
  uploadProgress,
  errorMessage,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputClick,
  onFileInputChange,
  onRetry,
  onClose,
  fileInputRef,
  accept = '.csv',
  extraContent,
  showFileFormatInfo = false,
  fileFormatInfo,
  confirmationContent,
  doneActions,
  errorActions,
  showCard = true,
}: ImportUIProps) {
  const content = (
    <CardContent className="space-y-6 p-6">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${step === 'parsing' || step === 'validating' ? 'pointer-events-none opacity-50' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onFileInputClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFileInputChange}
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
      {showFileFormatInfo && step === 'idle' && fileFormatInfo && (
        <Alert>
          <fileFormatInfo.icon className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {fileFormatInfo.content}
          </AlertDescription>
        </Alert>
      )}

      {/* Confirmation state */}
      {step === 'confirming' && confirmationContent && (
        confirmationContent
      )}

      {/* Extra content */}
      {extraContent}

      {/* Error actions */}
      {step === 'error' && errorActions && (
        <div className="flex gap-3">
          {errorActions}
        </div>
      )}

      {/* Done actions */}
      {step === 'done' && doneActions && (
        <div className="flex gap-3">
          {doneActions}
        </div>
      )}
    </CardContent>
  );

  if (showCard) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        {content}
      </Card>
    );
  }

  return <div className="w-full">{content}</div>;
}
