"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Settings, Save } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { DEFAULT_SITE_NAME } from "@/domain/settings/site-name"
import { clampSavingsRate } from "@/domain/settings/savings-rate"
import { clampReturnRate } from "@/domain/settings/return-rate"
import { saveGeneralSettings } from "@/app/actions/settings-actions"

interface SettingsClientProps {
  siteName: string
  settingsJson: Record<string, unknown>
}

export function SettingsClient({ siteName: initialSiteName, settingsJson }: SettingsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [siteName, setSiteName] = useState(
    initialSiteName || DEFAULT_SITE_NAME,
  )
  const [savingsTarget, setSavingsTarget] = useState(
    String(settingsJson.savings_rate_target ?? 30),
  )
  const [returnRate, setReturnRate] = useState(
    String(settingsJson.expected_return_rate ?? 5),
  )
  const [darkMode, setDarkMode] = useState(
    Boolean(settingsJson.dark_mode ?? false),
  )

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveGeneralSettings({
        siteName,
        savingsRateTarget: Number(savingsTarget),
        expectedReturnRate: Number(returnRate),
        darkMode,
      })
      if (result.success) {
        toast.success("设置已保存")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="text-primary size-6" />
          系统设置
        </h1>
        <p className="text-muted-foreground text-sm">
          应用偏好与配置
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本设置</CardTitle>
          <CardDescription>应用名称与显示偏好</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="siteName">应用名称</Label>
            <Input
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>深色模式</Label>
              <p className="text-muted-foreground text-xs">
                切换浅色/深色主题
              </p>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={setDarkMode}
            />
          </div>
        </CardContent>
      </Card>

      {/* Financial Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">财务参数</CardTitle>
          <CardDescription>储蓄率目标与预期收益率</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="savingsTarget">储蓄率目标 (%)</Label>
            <Input
              id="savingsTarget"
              type="number"
              min={0}
              max={100}
              value={savingsTarget}
              onChange={(e) =>
                setSavingsTarget(
                  String(clampSavingsRate(Number(e.target.value))),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="returnRate">预期年化收益率 (%)</Label>
            <Input
              id="returnRate"
              type="number"
              step={0.1}
              min={0}
              max={30}
              value={returnRate}
              onChange={(e) =>
                setReturnRate(
                  String(clampReturnRate(Number(e.target.value), 0, 30)),
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* MCP Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCP 配置</CardTitle>
          <CardDescription>
            Claude Desktop 等 AI 工具的连接配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            MCP 配置可在 AI 设置页面查看完整配置 JSON。
          </p>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  )
}
