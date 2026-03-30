"use client"

import { useState } from "react"
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

interface ManageClientProps {
  stats: {
    transactionCount: number
    transferCount: number
    years: number[]
  }
}

export function ManageClient({ stats }: ManageClientProps) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      // TODO: Wire to server action for backup
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      // TODO: Wire to server action for restore
    } finally {
      setImporting(false)
    }
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
            onClick={handleImport}
            disabled={importing}
          >
            <Upload className="mr-2 size-4" />
            {importing ? "导入中..." : "选择文件并导入"}
          </Button>
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
          <Button variant="destructive" disabled>
            <Trash2 className="mr-2 size-4" />
            清除所有数据
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
