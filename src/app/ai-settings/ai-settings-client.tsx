"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Save, Copy, Terminal, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PREDEFINED_AI_URLS,
  PREDEFINED_AI_MODELS,
  isCustomOption,
  isConfigComplete,
} from "@/domain/settings/ai-config";
import { buildMcpConfigJson } from "@/domain/settings/mcp-config";
import { saveAiSettings } from "@/app/actions/settings-actions";

interface AiSettingsClientProps {
  aiConfig: Record<string, unknown>;
  mcpParams: {
    workerUrl: string;
  };
}

export function AiSettingsClient({ aiConfig, mcpParams }: AiSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const [enabled, setEnabled] = useState(Boolean(aiConfig.enabled ?? false));
  const [baseURL, setBaseURL] = useState(String(aiConfig.baseURL ?? ""));
  const [modelName, setModelName] = useState(String(aiConfig.modelName ?? ""));
  const [apiKey, setApiKey] = useState(String(aiConfig.apiKey ?? ""));

  const complete = isConfigComplete({ baseURL, modelName, apiKey });
  const customUrl = isCustomOption(baseURL, PREDEFINED_AI_URLS);
  const customModel = isCustomOption(modelName, PREDEFINED_AI_MODELS);

  const mcpJson = buildMcpConfigJson({
    workerUrl: mcpParams.workerUrl,
  });

  const hasMcpCredentials = Boolean(mcpParams.workerUrl);

  const handleCopyMcp = async () => {
    try {
      await navigator.clipboard.writeText(mcpJson);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveAiSettings({
        enabled,
        baseURL,
        modelName,
        apiKey,
      });
      if (result.success) {
        toast.success("AI 设置已保存");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bot className="text-primary size-6" />
          AI 设置
        </h1>
        <p className="text-muted-foreground text-sm">配置 AI 分析功能的连接参数</p>
      </div>

      {/* Enable Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">启用 AI 分析</CardTitle>
          <CardDescription>开启后将在洞察页面使用 AI 进行智能分析</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-enabled">AI 分析</Label>
            <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
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
          <CardTitle className="text-base">MCP 服务器配置</CardTitle>
          <CardDescription>为 AI 助手（如 Claude Desktop）提供财务数据只读访问</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasMcpCredentials ? (
            <>
              <div className="space-y-2">
                <Label>MCP 服务器端点</Label>
                <code className="bg-muted block rounded p-2 font-mono text-xs">
                  {mcpParams.workerUrl}
                </code>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Claude Desktop 配置</Label>
                  <Button variant="outline" size="sm" onClick={handleCopyMcp} className="gap-1.5">
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "已复制" : "复制"}
                  </Button>
                </div>
                <pre className="bg-muted overflow-x-auto whitespace-pre-wrap rounded p-3 font-mono text-xs">
                  {mcpJson}
                </pre>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Terminal className="size-3" />
                  首次连接会通过浏览器进行 OAuth 登录授权
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-sm">
              请先登录以获取 MCP 配置
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {complete ? "配置完整" : "请填写所有必填字段"}
        </p>
        <Button onClick={handleSave} disabled={!complete || isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
