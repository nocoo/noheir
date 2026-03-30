import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy, Check, Terminal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMcpSettingsViewModel } from '@/viewmodels/settings/useMcpSettingsViewModel';

export function McpSettings() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const {
    email,
    configJson,
  } = useMcpSettingsViewModel();

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

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* MCP Header */}
        <div className="space-y-0.5">
          <Label className="text-base">MCP 服务器</Label>
          <p className="text-sm text-muted-foreground">
            为 AI 助手（如 Claude Desktop）提供财务数据只读访问
          </p>
        </div>

        {/* Auth Info */}
        <div className="space-y-3">
          <Label>认证账号</Label>
          <code className="block p-2 bg-muted rounded text-xs font-mono">
            {email || '<未登录>'}
          </code>
          <p className="text-xs text-muted-foreground">
            MCP 服务器使用此邮箱 + 密码登录，请将密码填入下方配置的 SUPABASE_PASSWORD 字段
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
      </CardContent>
    </Card>
  );
}
