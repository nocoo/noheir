import { useState, useEffect } from 'react';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_SITE_NAME = '个人财务管理';

export function SiteName() {
  const { user } = useAuth();
  const { data, loading, error, createMetadata, updateSiteName } = useSupabaseSettings();
  const [siteName, setSiteName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoCreated, setAutoCreated] = useState(false);

  // Auto-create default metadata for new users
  useEffect(() => {
    if (user && !loading && !data && !error && !autoCreated) {
      const autoCreate = async () => {
        setAutoCreated(true);
        try {
          await createMetadata(DEFAULT_SITE_NAME);
          toast.success('已自动创建默认配置');
        } catch (err) {
          // Silently fail - user can manually create later
          console.error('Auto-create failed:', err);
        }
      };
      autoCreate();
    }
  }, [user, loading, data, error, autoCreated, createMetadata]);

  // Sync site name from data
  useEffect(() => {
    if (data?.site_name) {
      setSiteName(data.site_name);
    }
  }, [data]);

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">请先登录以查看站点设置</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">错误: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    if (!siteName.trim()) {
      toast.error('站点名称不能为空');
      return;
    }

    setIsSaving(true);
    try {
      if (data) {
        await updateSiteName(siteName);
        toast.success('站点名称已更新');
      } else {
        await createMetadata(siteName);
        toast.success('站点配置已创建');
      }
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSiteName(data?.site_name || '');
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          站点设置
        </CardTitle>
        <CardDescription>配置您的站点基本信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data || !isEditing ? (
          <>
            <div className="space-y-2">
              <Label>站点名称</Label>
              {isEditing ? (
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="输入站点名称"
                />
              ) : (
                <p className="text-lg font-semibold">{data?.site_name || '未设置'}</p>
              )}
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    保存
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    取消
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  {data ? '编辑' : '设置站点名称'}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">首次使用，请设置您的站点名称</p>
            <Input
              placeholder="输入站点名称"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
            <Button onClick={handleSave} disabled={isSaving || !siteName.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建配置
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
