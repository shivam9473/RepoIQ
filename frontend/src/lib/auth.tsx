import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AuthUser {
  id: string;
  username: string;
  role?: string;
  avatar_url?: string | null;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user?: AuthUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "codeatlas_token";
const USER_KEY = "codeatlas_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  const setSession = useCallback((nextToken: string, nextUser?: AuthUser | null) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, setSession, logout }),
    [token, user, setSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
