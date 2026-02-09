import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Copy, Check, Terminal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useMcpSettingsViewModel } from '@/viewmodels/settings/useMcpSettingsViewModel';

export function McpSettings() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const {
    mcpEnabled,
    refreshToken,
    refreshError,
    refreshing,
    configJson,
    toggleMcp,
    handleRefreshToken,
  } = useMcpSettingsViewModel(
    async () => {
      const { data, error } = await supabase.auth.refreshSession();
      return {
        data: { session: data.session ? { refresh_token: data.session.refresh_token } : null },
        error: error ? { message: error.message } : null,
      };
    }
  );

  if (!user) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(configJson);
      setCopied(true);
      toast.success('配置已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const handleRefresh = async () => {
    await handleRefreshToken();
    if (refreshError) {
      toast.error(`刷新失败: ${refreshError}`);
    } else {
      toast.success('Refresh Token 已更新');
    }
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">MCP 服务器</Label>
            <p className="text-sm text-muted-foreground">
              为 AI 助手（如 Claude Desktop）提供财务数据只读访问
            </p>
          </div>
          <Switch
            checked={mcpEnabled}
            onCheckedChange={toggleMcp}
          />
        </div>

        {mcpEnabled && (
          <>
            {/* Refresh Token Section */}
            <div className="space-y-3">
              <Label>Refresh Token</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all max-h-20 overflow-auto">
                  {refreshToken || '<未获取>'}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="刷新 Token"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {refreshError && (
                <p className="text-xs text-destructive">{refreshError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Token 用于 MCP 服务器认证，刷新后需更新配置
              </p>
            </div>

            {/* Config JSON Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>MCP 配置</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-auto whitespace-pre-wrap">
                {configJson}
              </pre>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                将此配置添加到支持 MCP 的 AI 客户端配置文件中
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
