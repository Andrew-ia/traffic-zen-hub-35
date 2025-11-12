import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Role = 'adm' | 'basico' | 'simples';

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasAccess: (path: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'trafficpro.auth.token';
const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;
const OVERRIDES_PREFIX = 'trafficpro.page_access_overrides';

 

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && !token) {
      setToken(saved);
      // Try to fetch current user
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${saved}` } })
        .then(async (r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data) => {
          if (data?.success && data?.user) setUser(data.user);
          setIsLoading(false);
        })
        .catch(() => {
          // invalid token
          window.localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setUser(null);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.success || !data?.token || !data?.user) return false;
      window.localStorage.setItem(STORAGE_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      navigate('/');
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  const getAllowedRoutes = () => {
    if (user?.id && WORKSPACE_ID) {
      const key = `${OVERRIDES_PREFIX}:${WORKSPACE_ID}:${user.id}`;
      const raw = window.localStorage.getItem(key);
      let map: Record<string, boolean> = {};
      try {
        map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      } catch {
        map = {};
      }
      return Object.entries(map)
        .filter(([, allowed]) => !!allowed)
        .map(([prefix]) => prefix)
        .sort((a, b) => a.length - b.length);
    }
    return [] as string[];
  };

  const hasAccess = (path: string) => {
    if (user?.id && WORKSPACE_ID) {
      const key = `${OVERRIDES_PREFIX}:${WORKSPACE_ID}:${user.id}`;
      const raw = window.localStorage.getItem(key);
      let map: Record<string, boolean> = {};
      try {
        map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      } catch {
        map = {};
      }
      const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
      for (const [prefix, allowed] of entries) {
        if (path === prefix || path.startsWith(prefix + '/')) return !!allowed;
      }
    }
    if (user?.role === 'adm') return true;
    return false;
  };

  const value = useMemo<AuthContextValue>(() => ({ user, token, isLoading, login, logout, hasAccess }), [user, token, isLoading, login, logout, hasAccess]);

  // If user navigates to a blocked route, redirect to home or login
  useEffect(() => {
    if (isLoading) return; // Wait for auth to load
    if (location.pathname === '/login') return; // login is public
    if (!user) {
      navigate('/login');
      return;
    }
    if (!hasAccess(location.pathname)) {
      const allowed = getAllowedRoutes();
      navigate(allowed[0] || '/login');
    }
  }, [location.pathname, user, navigate, hasAccess, getAllowedRoutes, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
