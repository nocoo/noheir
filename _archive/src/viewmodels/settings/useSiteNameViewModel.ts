import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import {
  DEFAULT_SITE_NAME,
  getSiteNameDisplay,
  normalizeSiteName,
  shouldAutoCreateMetadata,
  validateSiteName,
} from '@/domain/settings/siteName';

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

export function useSiteNameViewModel(toast: ToastApi) {
  const { user } = useAuth();
  const { data, loading, error, createMetadata, updateSiteName } = useSupabaseSettings();
  const [siteName, setSiteName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoCreated, setAutoCreated] = useState(false);

  useEffect(() => {
    if (shouldAutoCreateMetadata({ user, loading, data, error, autoCreated })) {
      const autoCreate = async () => {
        setAutoCreated(true);
        try {
          await createMetadata(DEFAULT_SITE_NAME);
          toast.success('已自动创建默认配置');
        } catch (err) {
          console.error('Auto-create failed:', err);
        }
      };
      autoCreate();
    }
  }, [user, loading, data, error, autoCreated, createMetadata, toast]);

  useEffect(() => {
    if (data?.site_name) {
      setSiteName(data.site_name);
    }
  }, [data]);

  const canEdit = Boolean(user) && !loading && !error;
  const displayName = useMemo(() => getSiteNameDisplay(data?.site_name), [data]);

  const startEditing = () => setIsEditing(true);

  const handleCancel = () => {
    setSiteName(data?.site_name || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    const normalized = normalizeSiteName(siteName);
    if (!validateSiteName(normalized).valid) {
      toast.error('站点名称不能为空');
      return;
    }

    setIsSaving(true);
    try {
      if (data) {
        await updateSiteName(normalized);
        toast.success('站点名称已更新');
      } else {
        await createMetadata(normalized);
        toast.success('站点配置已创建');
      }
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    user,
    loading,
    error,
    data,
    siteName,
    isEditing,
    isSaving,
    canEdit,
    displayName,
    setSiteName,
    startEditing,
    handleSave,
    handleCancel,
  };
}
