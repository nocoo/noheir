import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bot, Info, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

// Predefined API URLs
const PREDEFINED_URLS = [
  { value: 'https://api.aihubmix.com/v1', label: 'AiHubMix (推荐)' },
  { value: 'https://api.openai.com/v1', label: 'OpenAI 官方' },
  { value: 'custom', label: '自定义 URL' },
];

// Predefined models (smaller/faster models)
const PREDEFINED_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (推荐)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'custom', label: '自定义模型' },
];

export function AISettings() {
  const { user } = useAuth();
  const { settings, updateAIConfig, updateAIEnabled } = useSettings();

  const [customUrl, setCustomUrl] = useState(settings.aiConfig.baseURL);
  const [customModel, setCustomModel] = useState(settings.aiConfig.modelName);
  const [apiKey, setApiKey] = useState(settings.aiConfig.apiKey);

  // Test status: 'idle' | 'testing' | 'success' | 'error'
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string>('');

  if (!user) {
    return null;
  }

  const currentUrl = settings.aiConfig.baseURL;
  const currentModel = settings.aiConfig.modelName;

  const handleUrlChange = (url: string) => {
    const newConfig = { ...settings.aiConfig, baseURL: url };
    updateAIConfig(newConfig);
    if (url !== 'custom') {
      setCustomUrl(url);
    }
  };

  const handleModelChange = (model: string) => {
    const newConfig = { ...settings.aiConfig, modelName: model };
    updateAIConfig(newConfig);
    if (model !== 'custom') {
      setCustomModel(model);
    }
  };

  const handleApiKeyChange = (key: string) => {
    const newConfig = { ...settings.aiConfig, apiKey: key };
    updateAIConfig(newConfig);
    setApiKey(key);
  };

  const handleSave = () => {
    // Build final config
    const finalConfig = {
      ...settings.aiConfig,
      baseURL: customUrl,
      modelName: customModel,
      apiKey: apiKey,
    };
    updateAIConfig(finalConfig);
    toast.success('AI 配置已保存');
  };

  const handleTest = async () => {
    if (!customUrl || !customModel || !apiKey) {
      toast.error('请先填写完整的配置信息');
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      const response = await fetch(`${customUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: customModel,
          messages: [
            { role: 'user', content: '你好' }
          ],
          max_completion_tokens: 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        setTestStatus('success');
        toast.success('✅ 连接成功！API 配置有效');
      } else {
        throw new Error('API 返回格式异常');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err.message || '连接失败');
      toast.error('❌ 连接失败，请检查配置');
    }
  };

  const isConfigured = settings.aiConfig.apiKey && settings.aiConfig.baseURL && settings.aiConfig.modelName;

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
            checked={settings.aiConfig.enabled}
            onCheckedChange={updateAIEnabled}
          />
        </div>

        {settings.aiConfig.enabled && (
          <>
            {/* API URL Selection */}
            <div className="space-y-3">
              <Label>API 地址</Label>
              <div className="grid grid-cols-2 gap-2">
                {PREDEFINED_URLS.map((url) => (
                  <Button
                    key={url.value}
                    variant={currentUrl === url.value || (url.value === 'custom' && !PREDEFINED_URLS.find(u => u.value === currentUrl)) ? 'default' : 'outline'}
                    onClick={() => handleUrlChange(url.value)}
                    className="justify-start"
                  >
                    {url.label}
                  </Button>
                ))}
              </div>
              {(currentUrl === 'custom' || !PREDEFINED_URLS.find(u => u.value === currentUrl)) && (
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
                {PREDEFINED_MODELS.map((model) => (
                  <Button
                    key={model.value}
                    variant={currentModel === model.value || (model.value === 'custom' && !PREDEFINED_MODELS.find(m => m.value === currentModel)) ? 'default' : 'outline'}
                    onClick={() => handleModelChange(model.value)}
                    className="justify-start text-sm"
                  >
                    {model.label}
                  </Button>
                ))}
              </div>
              {(currentModel === 'custom' || !PREDEFINED_MODELS.find(m => m.value === currentModel)) && (
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
              onClick={handleTest}
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
