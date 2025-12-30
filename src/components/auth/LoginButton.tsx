import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LoginButton() {
  const { user, signOut } = useAuth();

  // Only show logout button when user is logged in
  // Login is handled by the full-screen LoginPage
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

  // Not logged in - don't show anything (LoginPage will handle it)
  return null;
}
