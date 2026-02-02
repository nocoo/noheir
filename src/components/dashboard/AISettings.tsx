import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bot, Info, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PREDEFINED_AI_MODELS, PREDEFINED_AI_URLS } from '@/domain/settings/aiConfig';
import { useAISettingsViewModel } from '@/viewmodels/settings/useAISettingsViewModel';

export function AISettings() {
  const { user } = useAuth();
  const {
    currentUrl,
    currentModel,
    customUrl,
    customModel,
    apiKey,
    testStatus,
    testError,
    enabled,
    isCustomUrl,
    isCustomModel,
    isConfigured,
    updateAIEnabled,
    setCustomUrl,
    setCustomModel,
    handleUrlChange,
    handleModelChange,
    handleApiKeyChange,
    handleSave,
    handleTest,
  } = useAISettingsViewModel(toast);

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">启用 AI 助手</Label>
            <p className="text-sm text-muted-foreground">
              开启后将在页面右下角显示 AI 聊天助手
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={updateAIEnabled}
          />
        </div>

        {enabled && (
          <>
            {/* API URL Selection */}
            <div className="space-y-3">
              <Label>API 地址</Label>
              <div className="grid grid-cols-2 gap-2">
                {PREDEFINED_AI_URLS.map((url) => (
                  <Button
                    key={url.value}
                    variant={currentUrl === url.value || (url.value === 'custom' && isCustomUrl) ? 'default' : 'outline'}
                    onClick={() => handleUrlChange(url.value)}
                    className="justify-start"
                  >
                    {url.label}
                  </Button>
                ))}
              </div>
              {isCustomUrl && (
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              )}
            </div>

            {/* Model Selection */}
            <div className="space-y-3">
              <Label>模型名称</Label>
              <div className="grid grid-cols-2 gap-2">
                {PREDEFINED_AI_MODELS.map((model) => (
                  <Button
                    key={model.value}
                    variant={currentModel === model.value || (model.value === 'custom' && isCustomModel) ? 'default' : 'outline'}
                    onClick={() => handleModelChange(model.value)}
                    className="justify-start text-sm"
                  >
                    {model.label}
                  </Button>
                ))}
              </div>
              {isCustomModel && (
                <Input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="gpt-4o"
                />
              )}
            </div>

            {/* API Key */}
            <div className="space-y-3">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                您的 API Key 仅存储在本地浏览器中，不会上传到服务器
              </p>
            </div>

            {/* Test Button */}
            <Button
              onClick={() => handleTest()}
              disabled={testStatus === 'testing' || !customUrl || !customModel || !apiKey}
              variant="outline"
              className="w-full"
            >
              {testStatus === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testStatus === 'testing' ? '测试中...' : '🧪 测试配置'}
            </Button>

            {/* Test Result */}
            {testStatus !== 'idle' && (
              <div className={`
                p-3 rounded-lg text-sm flex items-center gap-2
                ${testStatus === 'success' ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' :
                  testStatus === 'error' ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' :
                  'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'}
              `}>
                {testStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {testStatus === 'error' && <XCircle className="h-4 w-4" />}
                <span className="flex-1">
                  {testStatus === 'testing' && '正在连接 API...'}
                  {testStatus === 'success' && '✅ 连接成功！API 配置有效'}
                  {testStatus === 'error' && `❌ 连接失败: ${testError}`}
                </span>
              </div>
            )}

            {/* Save Button */}
            <Button onClick={handleSave} className="w-full">
              保存配置
            </Button>

            {/* Status */}
            {isConfigured ? (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI 助手已配置完成
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                请完成上述配置后保存
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
