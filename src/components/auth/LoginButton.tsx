import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

export function LoginButton() {
  const { user, signOut } = useAuth();

  // Only show logout button when user is logged in
  // Login is handled by the full-screen LoginPage
  if (user) {
    return (
      <Button variant="outline" onClick={() => signOut()} className="w-full h-9 justify-between px-2">
        <span className="text-sm truncate flex items-center gap-2">
          <User className="h-4 w-4 shrink-0" />
          {user.email}
        </span>
        <LogOut className="h-4 w-4 shrink-0" />
      </Button>
    );
  }

  // Not logged in - don't show anything (LoginPage will handle it)
  return null;
}
