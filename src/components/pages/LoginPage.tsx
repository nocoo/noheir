import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Loader2 } from 'lucide-react';
import { useState } from 'react';

export function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setIsLoading(false);
    }
    // Note: Don't reset isLoading here because the page will redirect to Google OAuth
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          {/* Logo */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary overflow-hidden">
            <img src="/logo/logo-64.png" alt="Logo" className="h-14 w-14" />
          </div>

          <div className="space-y-2">
            <CardTitle className="text-2xl">个人财务管理</CardTitle>
            <CardDescription>
              请登录以访问您的财务数据
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Features */}
          <div className="space-y-3 pb-4">
            <div className="flex items-start gap-3 text-sm">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium">智能分析</p>
                <p className="text-muted-foreground">自动分析收支结构，洞察财务健康</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium">数据安全</p>
                <p className="text-muted-foreground">数据存储在您的私有账户中</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <div>
                <p className="font-medium">多端同步</p>
                <p className="text-muted-foreground">随时随地访问您的财务数据</p>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                使用 Google 登录
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-2">
            点击登录即表示您同意我们的服务条款和隐私政策
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
