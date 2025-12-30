import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, LogIn } from 'lucide-react';

export function LoginButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <Button variant="outline" disabled className="w-full">
        加载中...
      </Button>
    );
  }

  if (user) {
    return (
      <div className="space-y-2 w-full">
        <div className="text-xs text-muted-foreground text-center truncate px-1" title={user.email}>
          {user.email}
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut()} className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          登出
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={signInWithGoogle} className="w-full">
      <LogIn className="mr-2 h-4 w-4" />
      Google 登录
    </Button>
  );
}
