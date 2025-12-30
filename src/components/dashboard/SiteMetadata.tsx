import { useState } from 'react';
import { useSiteMetadata } from '@/hooks/useSiteMetadata';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SiteMetadata() {
  const { user } = useAuth();
  const { data, loading, error, createMetadata, updateMetadata } = useSiteMetadata();
  const [siteName, setSiteName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize site name from data
  useState(() => {
    if (data?.site_name) {
      setSiteName(data.site_name);
    }
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">请先登录以查看元数据</p>
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
        await updateMetadata({ site_name: siteName });
        toast.success('元数据已更新');
      } else {
        await createMetadata(siteName);
        toast.success('元数据已创建');
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
        <CardTitle>站点元数据</CardTitle>
        <CardDescription>管理您的站点配置信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {data ? (
          <>
            <div className="space-y-4">
              <div>
                <Label>站点名称</Label>
                {isEditing ? (
                  <Input
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="输入站点名称"
                    className="mt-1.5"
                  />
                ) : (
                  <p className="text-lg font-semibold mt-1.5">{data.site_name}</p>
                )}
              </div>

              <div>
                <Label>用户 ID</Label>
                <p className="text-sm font-mono text-muted-foreground mt-1.5">{data.owner_id}</p>
              </div>

              <div>
                <Label>设置 (JSON)</Label>
                <pre className="text-xs bg-muted p-3 rounded-md mt-1.5 overflow-x-auto">
                  {JSON.stringify(data.settings, null, 2)}
                </pre>
              </div>

              <div>
                <Label>创建时间</Label>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {new Date(data.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
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
                <Button onClick={() => setIsEditing(true)}>编辑</Button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">暂无元数据，请创建</p>
            <Input
              placeholder="输入站点名称"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
            <Button onClick={handleSave} disabled={isSaving || !siteName.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
