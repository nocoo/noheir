export const DEFAULT_SITE_NAME = '个人财务管理';

export const normalizeSiteName = (value: string): string => value.trim();

export const validateSiteName = (value: string): { valid: boolean } => {
  return { valid: normalizeSiteName(value).length > 0 };
};

export const shouldAutoCreateMetadata = (params: {
  user: unknown;
  loading: boolean;
  data: unknown;
  error: unknown;
  autoCreated: boolean;
}): boolean => {
  const { user, loading, data, error, autoCreated } = params;
  return Boolean(user) && !loading && !data && !error && !autoCreated;
};

export const getSiteNameDisplay = (value?: string): string => {
  return value && value.length > 0 ? value : '未设置';
};
