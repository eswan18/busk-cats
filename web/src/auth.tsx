import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";

interface Me {
  username: string;
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await api<Me>("/api/me");
      setMe(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMe(null);
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setMe(null);
      window.location.href = "/";
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
