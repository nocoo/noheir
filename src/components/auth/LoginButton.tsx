import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LogOut } from 'lucide-react';

export function LoginButton() {
  const { user, signOut } = useAuth();

  // Only show when user is logged in
  // Login is handled by the full-screen LoginPage
  if (!user) return null;

  const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const avatarUrl = user.user_metadata?.avatar_url || '';
  const initials = name
    ? name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] || '?').toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name || user.email || ''} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        {name && (
          <p className="text-sm font-medium leading-tight truncate">{name}</p>
        )}
        <p className="text-xs text-muted-foreground leading-tight truncate">{user.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => signOut()}
        className="h-7 w-7 shrink-0"
        title="退出登录"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
