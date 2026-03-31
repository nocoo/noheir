"use client"

import { useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Database,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  exportBackup,
  restoreBackup,
  clearAllData,
} from "@/app/actions/data-actions"

interface ManageClientProps {
  stats: {
    transactionCount: number
    transferCount: number
    years: number[]
  }
}

export function ManageClient({ stats }: ManageClientProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await exportBackup()
      if (result.success) {
        const json = JSON.stringify(result.data, null, 2)
        const blob = new Blob([json], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `noheir-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("数据已导出")
      } else {
        toast.error(result.error)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleImportClick = () => {
    fileRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      const transactions = Array.isArray(data.transactions) ? data.transactions : []
      const transfers = Array.isArray(data.transfers) ? data.transfers : []

      const result = await restoreBackup({ transactions, transfers })
      if (result.success) {
        toast.success(
          `导入完成: ${result.data.transactions}条交易, ${result.data.transfers}条转账`,
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("文件解析失败，请确保是有效的 JSON 备份文件")
    } finally {
      setImporting(false)
      // Reset file input so the same file can be selected again
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleClear = () => {
    setClearOpen(true)
  }

  const confirmClear = () => {
    startTransition(async () => {
      const result = await clearAllData()
      if (result.success) {
        toast.success("所有数据已清除")
        router.refresh()
      } else {
        toast.error(result.error)
      }
      setClearOpen(false)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Database className="text-primary size-6" />
          数据管理
        </h1>
        <p className="text-muted-foreground text-sm">
          导出、导入与清除数据
        </p>
      </div>

      {/* Data Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">交易记录</p>
              <p className="text-2xl font-bold">{stats.transactionCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">转账记录</p>
              <p className="text-2xl font-bold">{stats.transferCount}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground text-sm">覆盖年份</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {stats.years.map((y) => (
                  <Badge key={y} variant="outline">
                    {y}
                  </Badge>
                ))}
                {stats.years.length === 0 && (
                  <span className="text-muted-foreground text-sm">暂无</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">导出数据</CardTitle>
          <CardDescription>
            将所有数据导出为 JSON 文件备份
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 size-4" />
            {exporting ? "导出中..." : "导出 JSON"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">导入数据</CardTitle>
          <CardDescription>
            从 JSON 备份文件恢复数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleImportClick}
            disabled={importing}
          >
            <Upload className="mr-2 size-4" />
            {importing ? "导入中..." : "选择文件并导入"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" />
            危险操作
          </CardTitle>
          <CardDescription>以下操作不可撤销</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={isPending}
          >
            <Trash2 className="mr-2 size-4" />
            清除所有数据
          </Button>
        </CardContent>
      </Card>

      {/* Clear Confirmation */}
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="清除所有数据"
        description="确定要删除所有交易记录、转账记录、产品和资本单位吗？此操作不可撤销！"
        onConfirm={confirmClear}
        loading={isPending}
      />
    </div>
  )
}
