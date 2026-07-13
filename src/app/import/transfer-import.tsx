"use client";

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { countTransfersByYear, deleteAndImportTransfers } from "@/app/actions/import-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  type ChineseTransferCSVParseResult,
  parseChineseTransferCSV,
} from "@/domain/import/parse-chinese-transfer-csv";

type ImportStep = "idle" | "parsing" | "validating" | "confirming" | "uploading" | "done" | "error";

export function TransferImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ChineseTransferCSVParseResult | null>(null);
  const [csvYear, setCsvYear] = useState<number | null>(null);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resetState = useCallback(() => {
    setStep("idle");
    setFileName(null);
    setParseResult(null);
    setCsvYear(null);
    setExistingCount(null);
    setUploadProgress(0);
    setImportedCount(0);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Handle file selection
  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("请上传 CSV 格式的文件");
      return;
    }

    setFileName(file.name);
    setStep("parsing");
    setErrorMessage(null);

    try {
      const text = await file.text();

      const result = parseChineseTransferCSV(text);
      setParseResult(result);

      if (result.errors.length > 0 && result.transfers.length === 0) {
        const error = result.errors[0];
        if (!error) {
          setErrorMessage("未知解析错误");
        } else if (error.row === 1 && error.message.includes("表头")) {
          setErrorMessage('文件格式错误：您上传的可能是"收支流水"文件，请上传"转账数据"文件。');
        } else {
          setErrorMessage(error.message);
        }
        setStep("error");
        return;
      }

      if (result.transfers.length === 0) {
        setErrorMessage("CSV 文件中没有有效的转账数据");
        setStep("error");
        return;
      }

      // Validate year consistency
      const years = new Set(result.transfers.map((t) => t.year));
      if (years.size > 1) {
        setErrorMessage(
          `CSV 文件中包含多个年份的数据: ${Array.from(years).sort().join(", ")}。请确保所有数据属于同一年份。`,
        );
        setStep("error");
        return;
      }

      const firstTransfer = result.transfers[0];
      if (!firstTransfer) {
        setErrorMessage("CSV 文件中没有有效的转账数据");
        setStep("error");
        return;
      }

      const year = firstTransfer.year;
      setCsvYear(year);
      setStep("validating");

      // Check existing data count for this year
      const countResult = await countTransfersByYear(year);
      if (countResult.success) {
        setExistingCount(countResult.data.count);
      } else {
        setExistingCount(0);
      }

      setStep("confirming");
    } catch {
      setErrorMessage("文件读取失败");
      setStep("error");
    }
  };

  // Confirm and upload
  const handleConfirmUpload = () => {
    if (!csvYear || !parseResult?.transfers.length) return;

    startTransition(async () => {
      setStep("uploading");
      setUploadProgress(10);

      try {
        setUploadProgress(30);
        const rows = parseResult.transfers as unknown as Record<string, unknown>[];
        const result = await deleteAndImportTransfers(rows, csvYear);
        setUploadProgress(90);

        if (result.success) {
          setUploadProgress(100);
          setImportedCount(result.data.imported);
          setStep("done");
          toast.success(`成功导入 ${result.data.imported} 条转账记录`);
          router.refresh();
        } else {
          setErrorMessage(result.error);
          setStep("error");
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "上传失败");
        setStep("error");
      }
    });
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (step !== "idle") return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (step === "idle") setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && step === "idle") handleFile(file);
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        {/* Upload Area */}
        <div
          className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          } ${step === "parsing" || step === "validating" ? "pointer-events-none opacity-50" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => step === "idle" && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.currentTarget !== e.target) return;
            if (step === "idle" && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={step === "idle" ? 0 : -1}
          aria-label="选择 CSV 文件上传"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="space-y-4">
            <div className="flex justify-center">
              {step === "idle" && <Upload className="text-muted-foreground size-8" />}
              {(step === "parsing" || step === "validating") && (
                <Loader2 className="text-primary size-8 animate-spin" />
              )}
              {step === "confirming" && <CheckCircle2 className="size-8 text-green-600" />}
              {step === "uploading" && <Loader2 className="text-primary size-8 animate-spin" />}
              {step === "done" && <CheckCircle2 className="size-8 text-green-600" />}
              {step === "error" && <AlertTriangle className="text-destructive size-8" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {step === "idle" && "拖拽或点击上传转账 CSV 文件"}
                {step === "parsing" && "正在解析 CSV 文件..."}
                {step === "validating" && "正在验证数据..."}
                {step === "confirming" && "解析成功"}
                {step === "uploading" && "正在上传到云端..."}
                {step === "done" && "导入成功！"}
                {step === "error" && "导入失败"}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {step === "idle" && "支持 CSV 格式"}
                {step === "parsing" && (fileName || "")}
                {step === "validating" && `${parseResult?.transfers.length ?? 0} 条记录`}
                {step === "confirming" &&
                  `${parseResult?.transfers.length ?? 0} 条记录${parseResult && parseResult.filteredCount > 0 ? `（已过滤 ${parseResult.filteredCount} 条优惠抵扣）` : ""}`}
                {step === "uploading" && `${parseResult?.transfers.length ?? 0} 条记录`}
                {step === "done" && `已成功导入 ${importedCount} 条转账记录`}
                {step === "error" && (errorMessage || "未知错误")}
              </p>
            </div>

            {step === "idle" && (
              <Button variant="outline" className="mt-4">
                <FileText className="mr-2 size-4" />
                选择文件
              </Button>
            )}

            {step === "uploading" && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-muted-foreground text-xs">{uploadProgress}% 完成</p>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation panel */}
        {step === "confirming" && (
          <div className="space-y-4">
            <div className="bg-muted flex items-center gap-4 rounded-lg px-4 py-3">
              <Badge variant="outline" className="px-3 py-1 text-lg">
                <Calendar className="mr-1 size-3" />
                {csvYear}
              </Badge>
              <div className="text-sm">
                <span className="font-medium">{parseResult?.transfers.length}</span> 条转账记录
                {parseResult && parseResult.filteredCount > 0 && (
                  <span className="text-muted-foreground ml-2">
                    (已过滤 {parseResult.filteredCount} 条优惠抵扣)
                  </span>
                )}
              </div>
            </div>

            {existingCount && existingCount > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mr-1 inline size-4" />
                  该年份已存在 <span className="font-medium">{existingCount}</span>{" "}
                  条转账数据，上传新数据将覆盖旧数据。
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <CheckCircle2 className="mr-1 inline size-4" />
                  该年份暂无转账数据，将创建新记录。
                </p>
              </div>
            )}

            {/* Parse warnings */}
            {parseResult && parseResult.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                  解析警告 ({parseResult.warnings.length})
                </p>
                {parseResult.warnings.slice(0, 3).map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                    行 {w.row}: {w.message}
                  </p>
                ))}
                {parseResult.warnings.length > 3 && (
                  <p className="mt-1 text-xs text-amber-600">
                    ...还有 {parseResult.warnings.length - 3} 条警告
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetState}>
                取消
              </Button>
              <Button onClick={handleConfirmUpload} disabled={isPending} className="gap-2">
                确认上传
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Error actions */}
        {step === "error" && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetState}>
              重试
            </Button>
          </div>
        )}

        {/* Done actions */}
        {step === "done" && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetState}>
              继续导入
            </Button>
          </div>
        )}

        {/* File format info (visible when idle) */}
        {step === "idle" && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-sm">
                <span className="font-medium">CSV 格式要求：</span>
                日期,收支大类,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-sm">
                <Calendar className="mr-1 inline size-4" />
                <span className="font-medium">年份要求：</span>
                转账数据的年份需与收支数据对应。
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-sm">
                <AlertTriangle className="mr-1 inline size-4" />
                <span className="font-medium">自动过滤：</span>
                &quot;转账 / 优惠抵扣&quot;记录会被自动过滤（已在收支中记录）。
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
