export const PREDEFINED_AI_URLS = [
  { value: 'https://api.aihubmix.com/v1', label: 'AiHubMix (推荐)' },
  { value: 'https://api.openai.com/v1', label: 'OpenAI 官方' },
  { value: 'custom', label: '自定义 URL' },
];

export const PREDEFINED_AI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (推荐)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'custom', label: '自定义模型' },
];

export const isCustomOption = (value: string, list: Array<{ value: string }>) => {
  return value === 'custom' || !list.some(item => item.value === value);
};

export const isConfigComplete = (config: { baseURL: string; modelName: string; apiKey: string }) => {
  return Boolean(config.baseURL && config.modelName && config.apiKey);
};

export const buildFinalConfig = (config: {
  baseURL: string;
  modelName: string;
  apiKey: string;
}) => ({
  baseURL: config.baseURL.trim(),
  modelName: config.modelName.trim(),
  apiKey: config.apiKey.trim(),
});
