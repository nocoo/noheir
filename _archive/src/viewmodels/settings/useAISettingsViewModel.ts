import { useMemo, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import {
  PREDEFINED_AI_MODELS,
  PREDEFINED_AI_URLS,
  buildFinalConfig,
  isConfigComplete,
  isCustomOption,
} from '@/domain/settings/aiConfig';

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

type TestResponse = { choices?: Array<unknown> };

export function useAISettingsViewModel(toast: ToastApi) {
  const { settings, updateAIConfig, updateAIEnabled } = useSettings();
  const [customUrl, setCustomUrl] = useState(settings.aiConfig.baseURL);
  const [customModel, setCustomModel] = useState(settings.aiConfig.modelName);
  const [apiKey, setApiKey] = useState(settings.aiConfig.apiKey);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const currentUrl = settings.aiConfig.baseURL;
  const currentModel = settings.aiConfig.modelName;

  const isCustomUrl = isCustomOption(currentUrl, PREDEFINED_AI_URLS);
  const isCustomModel = isCustomOption(currentModel, PREDEFINED_AI_MODELS);

  const isConfigured = useMemo(
    () => isConfigComplete(settings.aiConfig),
    [settings.aiConfig]
  );

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
    const finalConfig = buildFinalConfig({
      baseURL: customUrl,
      modelName: customModel,
      apiKey,
    });
    updateAIConfig({ ...settings.aiConfig, ...finalConfig });
    toast.success('AI 配置已保存');
  };

  const handleTest = async (fetcher: typeof fetch = fetch) => {
    if (!isConfigComplete({ baseURL: customUrl, modelName: customModel, apiKey })) {
      toast.error('请先填写完整的配置信息');
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      const response = await fetcher(`${customUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: customModel,
          messages: [{ role: 'user', content: '你好' }],
          max_completion_tokens: 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as TestResponse;
      if (data.choices && data.choices.length > 0) {
        setTestStatus('success');
        toast.success('✅ 连接成功！API 配置有效');
      } else {
        throw new Error('API 返回格式异常');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      const message = err instanceof Error ? err.message : '连接失败';
      setTestError(message);
      toast.error('❌ 连接失败，请检查配置');
    }
  };

  return {
    enabled: settings.aiConfig.enabled,
    currentUrl,
    currentModel,
    customUrl,
    customModel,
    apiKey,
    testStatus,
    testError,
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
  };
}
