"use client"

import { useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileUp, FileText, AlertCircle, CheckCircle } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseImportFile } from "@/domain/import/parse-import-file"
import { restoreBackup } from "@/app/actions/data-actions"

export function ImportClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{
    transactions: number
    transfers: number
    errors: string[]
  } | null>(null)
  const [result, setResult] = useState<{
    transactions: number
    transfers: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Holds parsed data ready for submission
  const [parsedData, setParsedData] = useState<{
    transactions: Record<string, unknown>[]
    transfers: Record<string, unknown>[]
  } | null>(null)

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setResult(null)
    setError(null)
    setPreview(null)
    setParsedData(null)

    if (!selected) return

    try {
      const text = await selected.text()
      const parsed = parseImportFile(text, selected.name)

      if (parsed.errors.length > 0 && parsed.transactions.length === 0 && parsed.transfers.length === 0) {
        setError(parsed.errors.join("; "))
        return
      }

      setParsedData({
        transactions: parsed.transactions,
        transfers: parsed.transfers,
      })
      setPreview({
        transactions: parsed.transactions.length,
        transfers: parsed.transfers.length,
        errors: parsed.errors,
      })
    } catch {
      setError("Failed to read file")
    }
  }

  const handleImport = () => {
    if (!parsedData) return
    startTransition(async () => {
      setError(null)
      try {
        const importResult = await restoreBackup(parsedData)
        if (importResult.success) {
          setResult(importResult.data)
          toast.success(
            `Imported ${importResult.data.transactions} transactions, ${importResult.data.transfers} transfers`,
          )
          router.refresh()
        } else {
          setError(importResult.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileUp className="text-primary size-6" />
          数据导入
        </h1>
        <p className="text-muted-foreground text-sm">
          从 CSV 或 JSON 文件导入交易数据
        </p>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">选择文件</CardTitle>
          <CardDescription>
            支持 CSV、JSON 格式的交易数据文件
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-muted hover:border-primary/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileText className="text-muted-foreground mb-2 size-10" />
            <p className="text-muted-foreground text-sm">
              {file ? file.name : "点击选择文件或拖拽到此处"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              CSV, JSON (最大 10MB)
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            onChange={handleSelect}
            className="hidden"
          />

          {/* Preview */}
          {preview && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{file?.name}</p>
                <p className="text-muted-foreground text-xs">
                  {preview.transactions}条交易 · {preview.transfers}条转账
                  {preview.errors.length > 0 && (
                    <span className="text-amber-600 ml-2">
                      ({preview.errors.length}条警告)
                    </span>
                  )}
                </p>
              </div>
              <Button
                onClick={handleImport}
                disabled={isPending || (preview.transactions === 0 && preview.transfers === 0)}
                size="sm"
              >
                {isPending ? "导入中..." : "开始导入"}
              </Button>
            </div>
          )}

          {/* Parse warnings */}
          {preview && preview.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-amber-800 dark:text-amber-300 mb-1 text-xs font-medium">
                解析警告
              </p>
              {preview.errors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-amber-700 dark:text-amber-400 text-xs">
                  {err}
                </p>
              ))}
              {preview.errors.length > 5 && (
                <p className="text-amber-600 text-xs mt-1">
                  ...还有 {preview.errors.length - 5} 条警告
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="size-4 text-emerald-500" />
              导入完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-sm">交易记录</p>
                <p className="text-xl font-bold">{result.transactions}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">转账记录</p>
                <p className="text-xl font-bold">{result.transfers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-2 pt-4">
            <AlertCircle className="text-destructive size-4" />
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
