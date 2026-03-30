"use client"

import { useState, useRef } from "react"
import { FileUp, FileText, AlertCircle, CheckCircle } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export function ImportClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{
    transactions: number
    transfers: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setResult(null)
    setError(null)
  }

  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      // TODO: Wire to server action for file upload + restore
      // Placeholder
      setResult({ transactions: 0, transfers: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败")
    } finally {
      setUploading(false)
    }
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

          {file && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                onClick={handleImport}
                disabled={uploading}
                size="sm"
              >
                {uploading ? "导入中..." : "开始导入"}
              </Button>
            </div>
          )}

          {uploading && (
            <Progress value={50} className="h-2" />
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
