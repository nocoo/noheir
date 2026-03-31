"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Bot, Save, Copy } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PREDEFINED_AI_URLS,
  PREDEFINED_AI_MODELS,
  isCustomOption,
  isConfigComplete,
} from "@/domain/settings/ai-config"
import { buildMcpConfigJson } from "@/domain/settings/mcp-config"
import { saveAiSettings } from "@/app/actions/settings-actions"

interface AiSettingsClientProps {
  aiConfig: Record<string, unknown>
}

export function AiSettingsClient({ aiConfig }: AiSettingsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [enabled, setEnabled] = useState(Boolean(aiConfig.enabled ?? false))
  const [baseURL, setBaseURL] = useState(String(aiConfig.baseURL ?? ""))
  const [modelName, setModelName] = useState(String(aiConfig.modelName ?? ""))
  const [apiKey, setApiKey] = useState(String(aiConfig.apiKey ?? ""))

  const complete = isConfigComplete({ baseURL, modelName, apiKey })
  const customUrl = isCustomOption(baseURL, PREDEFINED_AI_URLS)
  const customModel = isCustomOption(modelName, PREDEFINED_AI_MODELS)

  const mcpJson = buildMcpConfigJson({
    workerUrl: "YOUR_WORKER_URL",
    workerToken: "YOUR_WORKER_TOKEN",
    userId: "YOUR_USER_ID",
    projectPath: process.cwd?.() ?? ".",
  })

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(mcpJson)
    toast.success("已复制到剪贴板")
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveAiSettings({
        enabled,
        baseURL,
        modelName,
        apiKey,
      })
      if (result.success) {
        toast.success("AI 设置已保存")
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
          <Bot className="text-primary size-6" />
          AI 设置
        </h1>
        <p className="text-muted-foreground text-sm">
          配置 AI 分析功能的连接参数
        </p>
      </div>

      {/* Enable Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">启用 AI 分析</CardTitle>
          <CardDescription>
            开启后将在洞察页面使用 AI 进行智能分析
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-enabled">AI 分析</Label>
            <Switch
              id="ai-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* API Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API 配置</CardTitle>
          <CardDescription>配置 AI 服务的接口地址、模型和密钥</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>接口地址</Label>
            <Select value={baseURL} onValueChange={setBaseURL}>
              <SelectTrigger>
                <SelectValue placeholder="选择 API 地址" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_AI_URLS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customUrl && (
              <Input
                placeholder="输入自定义 API 地址"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>模型</Label>
            <Select value={modelName} onValueChange={setModelName}>
              <SelectTrigger>
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_AI_MODELS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customModel && (
              <Input
                placeholder="输入自定义模型名称"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API 密钥</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
        </CardContent>
      </Card>

      {/* MCP Config Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCP 连接配置</CardTitle>
          <CardDescription>
            复制此 JSON 到 Claude Desktop 配置文件
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
            {mcpJson}
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleCopyMcp}
          >
            <Copy className="mr-1 size-3" />
            复制
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {complete
            ? "配置完整"
            : "请填写所有必填字段"}
        </p>
        <Button onClick={handleSave} disabled={!complete || isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  )
}
