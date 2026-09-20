import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { workerDbClient } from "./worker-db-client";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workerDbClient.getMe();
      setUser(data.user);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = () => {
    window.location.href = "/cdn-cgi/access/logout";
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh: fetchMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
